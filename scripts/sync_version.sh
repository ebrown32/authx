#!/bin/bash

# Sets the versions of the current package to $VERSION, and also sets the version
# of all @authx/ packages to $VERSION. This is currently primarily used by CI.

if [ -z "$VERSION" ]; then
  echo 'VERSION env var must be set'
else
  sed 's/"\(@authx.\+\|version\)": ".\+"/"\1": "'"$VERSION"'"/g' -i package.json
fi
