#!/bin/sh
# Create an orphaned branch with a commit where /lib and /build are present
# Then tag that commit with current version from package.json and push
# to github hence creating an npm-installable, versioned variant of this
# package without using an npm registry

branch=$(git branch | sed -n -e 's/^\* \(.*\)/\1/p')
version=$(node -e "console.log(require('./package.json')['version'])")

if [[ $(git diff --shortstat 2> /dev/null | tail -n1) != "" ]]; then
	echo "Please stash or commit current changes"
	exit
fi

if [ "$branch" == "release" ]; then
	echo "Please run this from master branch (or any other branch that is not release)"
	exit;
fi

if [ "$1" == "--bump" ]; then
	npm version patch
	version=$(node -e "console.log(require('./package.json')['version'])")
else
	if [[ `git tag -l v$version` == "v$version" ]]; then
		echo "It seems that tag 'v$version' already exists. Either remove the tag or use --bump"
		echo "latter option will bump patch version in package.json, create a commit"
		echo "in current branch and then proceed with tagging and releasing as normal"
		exit;
	fi
	if [[ `git tag -l v$version-release` == "v$version-release" ]]; then
		echo "It seems that tag 'v$version-release' exists while 'v$version' doesn't seem to be present"
		echo "Either run this script --bump or fix your tags manually";
		exit
	fi
fi

if [ `git branch --list release` ]; then
	git branch -D release
fi

git checkout --orphan release
sed -i '' '/lib/d' ./.gitignore
sed -i '' '/build/d' ./.gitignore

npm install
npm run build
git add -A
git commit -m "Release $version"
git tag "v$version-release"
git push origin --tags
git checkout $branch