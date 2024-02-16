#!/bin/bash

~/.cargo/bin/trunk build
cp -f dist/hive.js dist/hive_bg.wasm .
