build: fx-build cr-build

fx-build:
	web-ext -s ./extension -a ./dist build

cr-build:
	crx pack ./extension -o ./dist/youtube-cinema.crx -p .chrome-extension-key.pem
