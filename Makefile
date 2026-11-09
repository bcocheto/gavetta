UUID    := gavetta@bcocheto.github.io
SRC     := $(UUID)
DEST    := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install schemas run pack lint

schemas:
	glib-compile-schemas $(SRC)/schemas

install: schemas
	mkdir -p $(DEST)
	rsync -a --delete $(SRC)/ $(DEST)/
	@echo "Instalada em $(DEST). Reinicie a sessão (Wayland) ou rode 'make run'."

# Shell aninhado para testar sem sair da sessão (precisa de mutter-devkit)
run: install
	dbus-run-session -- gnome-shell --devkit --wayland

pack: schemas
	gnome-extensions pack $(SRC) --force --extra-source=store.js --extra-source=popup.js --extra-source=data.js --out-dir=dist

lint:
	@for f in $(SRC)/*.js; do node --check --input-type=module < $$f && echo "ok $$f"; done
	glib-compile-schemas --strict --dry-run $(SRC)/schemas && echo "ok schema"
