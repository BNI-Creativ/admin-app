#!/bin/bash

git remote get-url origin && {
	echo "origin already exists"
	exit 1
}

git remote add -f origin https://github.com/commodo/liste-prezenta
git branch --set-upstream-to=origin/main main
git pull
