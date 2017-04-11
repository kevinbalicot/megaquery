DIST_DIR = ./dist
BIN_DIR = ./node_modules/.bin
BIN_FILE = $(DIST_DIR)/megaqueries-client.js
DEMO_DIR = ./demo

build: $(BIN_FILE)

clean:
	rm -rf ./node_modules $(DIST_DIR)

.PHONY: build clean

node_modules: package.json
	npm install --ignore-scripts

$(DIST_DIR):
	mkdir -p $@

$(BIN_FILE): $(DIST_DIR) node_modules
	$(BIN_DIR)/browserify src/client/index.js -o $(BIN_FILE) -t [ babelify ]
