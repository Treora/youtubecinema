build: fx-build cr-build

fx-build:
	web-ext -a .. build
	rename -f "s/\.zip$$/.xpi/" ../youtubecinema-*.zip

cr-build:
	(cd .. && chromium-browser --pack-extension=youtubecinema --pack-extension-key=youtubecinema.pem)
