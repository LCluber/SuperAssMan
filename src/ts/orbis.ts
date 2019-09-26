import { Logger, Group, LevelName } from "@lcluber/mouettejs";
import { Download } from "./download";
import { Progress } from "./progress";

export type ValidExtensions = {
  file: string[];
  img: string[];
  sound: string[];
  [key: string]: string[];
};

export type Default = {
  maxPending: number;
  tick: number;
};

export interface Asset {
  name: string;
  params: {
    [key: string]: string | number | boolean | Array<string | number | boolean>;
  };
  download?: Download;
}

export interface Assets {
  [key: string]: {
    folder: string;
    files: Asset[];
  };
}

export class Loader {
  assets: Assets; //data from the assets file
  path: string;
  progress: Progress;
  pendingRequests: number;

  tick: number;
  maxPendingRequests: number;
  default: Default;

  validExtensions: ValidExtensions;
  log: Group;

  constructor(
    assets: Assets,
    assetsPath: string,
    progressBarId: string,
    progressTextId: string
  ) {
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

  // public setTick(duration: number): void {
  //   this.tick.duration = duration;
  // }
  //
  // public setMaxPendingRequests(maxPendingRequests: number): void {
  //   this.maxPendingRequests = maxPendingRequests;
  // }

  public setLogLevel(name: LevelName): LevelName {
    return this.log.setLevel(name);
  }

  public getLogLevel(): LevelName {
    return this.log.getLevel();
  }

  public getAsset(name: string): Asset | false {
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

  public getList(type: string): Asset[] | false {
    if (this.assets.hasOwnProperty(type)) {
      return this.assets[type].files;
    }
    return false;
  }

  public launch(): Promise<void> {
    return new Promise((resolve: Function, reject: Function) => {
      if (this.progress.nbAssets) {
        this.progress.start();
        let intervalID = setInterval(() => {
          this.sendRequest();
          // let percentage = this.progress.updateBar();
          if (this.progress.finished) {
            clearInterval(intervalID);
            resolve();
          }
        }, this.tick);
      } else {
        reject("!! nothing to load here");
      }
    });
  }

  public resetProgress() {
    this.progress.reset();
  }

  private getAssetType(extension: string): string | false {
    for (let property in this.validExtensions) {
      if (this.validExtensions.hasOwnProperty(property)) {
        if (this.checkExtension(extension, this.validExtensions[property])) {
          return property;
        }
      }
    }
    return false;
  }

  private createAssets(): void {
    this.progress.nbAssets = 0;
    for (let property in this.assets) {
      if (this.assets.hasOwnProperty(property)) {
        let type = this.assets[property];
        let folder = type.folder ? type.folder + "/" : "";
        for (let file of type.files) {
          if (!file.download && file.hasOwnProperty("name")) {
            let extension = this.getExtension(file.name);
            if (extension) {
              let type = this.getAssetType(extension);
              if (type) {
                file.download = new Download(
                  this.path + "/" + folder,
                  file.name,
                  extension,
                  type
                );
                this.progress.nbAssets++;
              }
            }
          }
        }
      }
    }
    //   _this.logs.add(_this.requestsLength + ' requests to perform');
    //   _this.sendRequest();
    // }else
    //   _this.logs.add('!! error during config file AJAX request');
  }

  private sendRequest(): boolean {
    if (this.pendingRequests < this.maxPendingRequests) {
      let nextAsset = this.getNextAssetToLoad();
      if (nextAsset) {
        nextAsset.sendRequest().then(response => {
          // if(response) {
          this.pendingRequests--;
          this.progress.update(response);
          //this.achievedRequests++;
          //
        });
        return true;
      }
    }
    return false;
  }

  private getNextAssetToLoad(): Asset | false {
    for (let property in this.assets) {
      if (this.assets.hasOwnProperty(property)) {
        let type = this.assets[property];
        for (let file of type.files) {
          if (file.hasOwnProperty("asset") && !file.asset.isRequestSent()) {
            return file.asset;
          }
        }
      }
    }
    return false;
  }

  private removeTrailingSlash(path: string): string {
    return path.replace(/\/+$/, "");
  }

  private getExtension(path: string): string | undefined {
    return path.split(".").pop();
  }

  private checkExtension(
    extension: string,
    validExtensions: string[]
  ): boolean {
    // return validExtensions.find(validExtension => extension === validExtension) != undefined;
    for (let validExtension of validExtensions) {
      if (extension === validExtension) {
        return true;
      }
    }
    return false;
  }
}
