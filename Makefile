# Half-baked Makefile; mostly for reference of commands.
# Requires two tools, web-ext and crx.
# npm install -g web-ext crx

.PHONY: build
build: fx-build cr-build

.PHONY: fx-build
fx-build:
	web-ext -s ./extension -a ./dist build

# Note: crx will overwrite a pre-existing output file.
.PHONY: cr-build
cr-build:
	crx pack ./extension -o ./dist/youtube-cinema.crx -p .chrome-extension-key.pem
