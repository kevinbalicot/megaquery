DIST_DIR = ./dist
CONFIG_DIR = ./config
BIN_DIR = ./node_modules/.bin
BIN_FILE = $(DIST_DIR)/megaquery.js

build-dev: $(DIST_DIR) node_modules
	$(BIN_DIR)/browserify client/index.js -d -o $(BIN_FILE) -t [ babelify ]

build: $(DIST_DIR) node_modules
	$(BIN_DIR)/browserify client/index.js -t [ babelify ] | $(BIN_DIR)/uglifyjs --keep-fnames -c -o $(BIN_FILE)

clean:
	rm -rf ./node_modules && rm -rf $(DIST_DIR)

.PHONY: build-dev build clean

node_modules: package.json
	npm install --ignore-scripts

$(DIST_DIR):
	mkdir -p $@
