fx-build:
	web-ext -a . build
	rename -f "s/\.zip$$/.xpi/" youtubecinema-*.zip
