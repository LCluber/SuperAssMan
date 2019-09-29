#!/usr/bin/env bash
LC_ALL=C

local_branch="$(git rev-parse --abbrev-ref HEAD)"

valid_branch_regex="^(feature|bugfix|library|prerelease|release|hotfix)\/[a-z0-9._-]+$ || ^(dev|origin\/dev)$"

message="There is something wrong with your branch name. Branch names in this project must adhere to this contract: $valid_branch_regex. Your commit will be rejected. You should rename your branch to a valid name and try again."

if [[ ! $local_branch =~ $valid_branch_regex ]]
then
    echo "$message"
    exit 0
fi

exit 0