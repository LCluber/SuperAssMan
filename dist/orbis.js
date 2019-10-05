/** MIT License
* 
* Copyright (c) 2011 Ludovic CLUBER 
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*
* http://orbisjs.lcluber.com
*/

import { Logger } from '@lcluber/mouettejs';
import { FSM } from '@lcluber/taipanjs';
import { HTTP } from '@lcluber/aiasjs';
import { Binding, Dom } from '@lcluber/weejs';
import { Utils } from '@lcluber/type6js';
import { Player } from '@lcluber/frameratjs';

function loadImage(path) {
    let log = Logger.addGroup("Orbis");
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = path;
        img.name = getName(path);
        log.info("xhr processing starting (" + path + ")");
        img.addEventListener("load", () => {
            log.info("xhr (" + path + ") done");
            resolve(img);
        });
        img.addEventListener("error", () => {
            log.error("xhr (" + path + ") failed");
            reject(new Error("xhr (" + path + ") failed"));
        });
    });
}
function getName(path) {
    return path.replace(/^.*[\\\/]/, "");
}

function loadSound(path) {
    return HTTP.GET(path, "audiobuffer");
}

function loadFile(path) {
    return HTTP.GET(path, "text");
}

class Request {
    constructor() {
        this.fsm = new FSM([
            { name: "send", from: "idle", to: "pending" },
            { name: "success", from: "pending", to: "success" },
            { name: "error", from: "pending", to: "error" }
        ]);
        this.ajax = {
            file: loadFile,
            img: loadImage,
            sound: loadSound
        };
    }
    send(path, type) {
        if (this.fsm["send"]()) {
            return this.ajax[type](path)
                .then((response) => {
                this.fsm["success"]();
                return response;
            })
                .catch(() => {
                this.fsm["error"]();
                return null;
            });
        }
        else {
            return new Promise(() => {
                return null;
            });
        }
    }
}

class XHR {
    constructor(path, extension, type) {
        this.path = path;
        this.extension = extension;
        this.type = type;
        this.request = new Request();
        this.response = null;
    }
    sendRequest(fileName) {
        if (this.response) {
            return new Promise(() => {
                return fileName;
            });
        }
        else {
            return this.request
                .send(this.path + fileName, this.type)
                .then(response => {
                if (response) {
                    this.response = response;
                }
                return fileName;
            });
        }
    }
    getRequestStatus() {
        return this.request ? this.request.fsm.state : "done";
    }
    isRequestSent() {
        if (this.getRequestStatus() != "idle") {
            delete this.request;
            return true;
        }
        return false;
    }
}

class Progress {
    constructor(barId, textId) {
        this.rate = 0.0;
        this.total = 0;
        this.percentage = 0.0;
        this.target = 0;
        this.speed = 40;
        this.nbAssets = 0;
        this.barWidth = 0;
        this.running = false;
        this.bar = null;
        this.number = null;
        this.animation = null;
        if (barId) {
            let bar = Dom.findById(barId);
            if (bar) {
                this.barWidth = bar.clientWidth;
                let percentBar = bar.children[1];
                this.bar = percentBar
                    ? new Binding(percentBar, "style.width", "0px")
                    : null;
                let number = bar.children[0];
                this.number = number ? new Binding(number, "", 0) : null;
                this.animation = new Player(this.animateBar);
                this.animation.setScope(this);
            }
        }
        this.text = textId ? new Binding(textId, "", "Loading") : null;
    }
    animateBar() {
        return (this.running = this.animation
            ? this.updateBar(this.animation.getDelta())
            : false);
    }
    start() {
        if (this.animation) {
            this.animation.play();
        }
    }
    reset() {
        this.running = false;
        this.percentage = 0.0;
        if (this.text) {
            this.text.update("Loading");
        }
    }
    update(text) {
        this.total++;
        this.rate = this.total / this.nbAssets;
        this.target = Math.round(this.rate * 100);
        if (this.text) {
            this.text.update(text);
        }
    }
    updateBar(delta) {
        this.percentage += this.speed * delta;
        if (this.percentage >= this.target) {
            this.percentage = this.target;
        }
        const flooredPercentage = Utils.floor(this.percentage, 0);
        if (this.bar) {
            this.bar.update(Utils.map(this.percentage, 0, 100, 0, this.barWidth) + "px");
        }
        if (this.number) {
            this.number.update(flooredPercentage + "%");
        }
        if (flooredPercentage === 100) {
            if (this.animation) {
                this.animation.stop();
            }
            if (this.text) {
                this.text.update("Loading complete");
            }
            return false;
        }
        return true;
    }
}

class Loader {
    constructor(assets, assetsPath, progressBarId, progressTextId) {
        this.default = {
            maxPending: 6,
            tick: 100
        };
        this.validExtensions = {
            file: ["txt", "text", "json", "glsl", "babylon"],
            img: ["png", "jpg", "jpeg", "gif"],
            sound: ["mp3", "ogg", "wav"]
        };
        this.assets = assets;
        this.path = this.removeTrailingSlash(assetsPath);
        this.pendingRequests = 0;
        this.tick = this.default.tick;
        this.maxPendingRequests = this.default.maxPending;
        this.progress = new Progress(progressBarId, progressTextId);
        this.log = Logger.addGroup("Orbis");
        this.createAssets();
    }
    setLogLevel(name) {
        return this.log.setLevel(name);
    }
    getLogLevel() {
        return this.log.getLevel();
    }
    getAsset(name) {
        for (let property in this.assets) {
            if (this.assets.hasOwnProperty(property)) {
                for (let file of this.assets[property].files) {
                    if (file.name === name) {
                        return file;
                    }
                }
            }
        }
        return false;
    }
    getList(type) {
        if (this.assets.hasOwnProperty(type)) {
            return this.assets[type].files;
        }
        return false;
    }
    launch() {
        return new Promise((resolve, reject) => {
            if (this.progress.nbAssets) {
                this.progress.start();
                let intervalID = setInterval(() => {
                    this.sendRequest();
                    if (!this.progress.running) {
                        clearInterval(intervalID);
                        resolve();
                    }
                }, this.tick);
            }
            else {
                reject("!! nothing to load here");
            }
        });
    }
    resetProgress() {
        this.progress.reset();
    }
    getAssetType(extension) {
        for (let property in this.validExtensions) {
            if (this.validExtensions.hasOwnProperty(property)) {
                if (this.checkExtension(extension, this.validExtensions[property])) {
                    return property;
                }
            }
        }
        return false;
    }
    createAssets() {
        this.progress.nbAssets = 0;
        for (let property in this.assets) {
            if (this.assets.hasOwnProperty(property)) {
                let type = this.assets[property];
                let folder = type.folder ? type.folder + "/" : "";
                for (let file of type.files) {
                    if (!file.xhr && file.hasOwnProperty("name")) {
                        let extension = this.getExtension(file.name);
                        if (extension) {
                            let type = this.getAssetType(extension);
                            if (type) {
                                file.xhr = new XHR(this.path + "/" + folder, extension, type);
                                this.progress.nbAssets++;
                            }
                        }
                    }
                }
            }
        }
    }
    sendRequest() {
        if (this.pendingRequests < this.maxPendingRequests) {
            let nextAsset = this.getNextAssetToLoad();
            if (nextAsset) {
                nextAsset.xhr.sendRequest(nextAsset.name).then(response => {
                    this.pendingRequests--;
                    this.progress.update(response);
                });
                return true;
            }
        }
        return false;
    }
    getNextAssetToLoad() {
        for (let property in this.assets) {
            if (this.assets.hasOwnProperty(property)) {
                let type = this.assets[property];
                for (let file of type.files) {
                    if (file.xhr && !file.xhr.isRequestSent()) {
                        return file;
                    }
                }
            }
        }
        return false;
    }
    removeTrailingSlash(path) {
        return path.replace(/\/+$/, "");
    }
    getExtension(path) {
        return path.split(".").pop();
    }
    checkExtension(extension, validExtensions) {
        for (let validExtension of validExtensions) {
            if (extension === validExtension) {
                return true;
            }
        }
        return false;
    }
}

export { Loader };
