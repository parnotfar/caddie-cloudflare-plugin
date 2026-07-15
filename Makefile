MODULE_HOME ?= $(HOME)/.caddie_modules
MODULE_DEST := $(MODULE_HOME)/.caddie_cloudflare
MODULE_SRC_DEST := $(MODULE_HOME)/caddie-cloudflare-plugin
SRC_MODULE := modules/dot_caddie_cloudflare

.PHONY: help install uninstall lint test

help:
	@printf '%s\n' \
		'caddie-cloudflare-plugin' \
		'' \
		'  make install    Install module + share scripts into ~/.caddie_modules' \
		'  make uninstall  Remove installed module and share tree' \
		'  make lint       Lint the module with caddie core:lint' \
		'  make test       Run Node unit tests'

install:
	@mkdir -p "$(MODULE_HOME)"
	@echo "==> Installing module to $(MODULE_DEST)"
	cp "$(SRC_MODULE)" "$(MODULE_DEST)"
	chmod +x "$(MODULE_DEST)"
	@echo "==> Syncing share tree to $(MODULE_SRC_DEST)"
	rm -rf "$(MODULE_SRC_DEST)"
	mkdir -p "$(MODULE_SRC_DEST)"
	cp -R share "$(MODULE_SRC_DEST)/"
	cp package.json "$(MODULE_SRC_DEST)/"
	@echo "Installed caddie cloudflare module to $(MODULE_DEST)"
	@echo "Share scripts: $(MODULE_SRC_DEST)/share/cloudflare-pages"
	@echo "Run: caddie reload"

uninstall:
	@if [ -f "$(MODULE_DEST)" ]; then rm "$(MODULE_DEST)" && echo "Removed $(MODULE_DEST)"; fi
	@if [ -d "$(MODULE_SRC_DEST)" ]; then rm -rf "$(MODULE_SRC_DEST)" && echo "Removed $(MODULE_SRC_DEST)"; fi

lint:
	caddie core:lint "$(SRC_MODULE)"

test:
	npm test
