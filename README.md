# Gavetta

Histórico da área de transferência para o GNOME Shell (50), no estilo do `Win+V`: texto, links e imagens, com busca, fixados e colar direto no app.

## Status

MVP (0.1.0) em esqueleto: monitor do clipboard, lista com busca, fixar/apagar, colar com `Ctrl+V`.

## Instalar (desenvolvimento)

```bash
make install        # compila o schema e copia para ~/.local/share/gnome-shell/extensions
gnome-extensions enable gavetta@bcocheto.github.io
```

No Wayland é preciso sair e entrar na sessão após o primeiro `install`. Para testar sem isso: `make run` (shell aninhado, requer `mutter-devkit`).

## Atalho

Padrão `Super+Shift+V` (o `Super+V` já pertence à bandeja de notificações do GNOME). Dá para trocar via `dconf`/`gsettings` na chave `toggle-shortcut`.

## Pendências

- Vídeos e arquivos (`text/uri-list`) além de texto/imagem.
- Colar com `Ctrl+Shift+V` em terminais.
- Ignorar apps sensíveis (gerenciadores de senha).
- Janela de preferências, abas (emoji, snippets), popup perto do cursor.
- Licença GPL-3.0-or-later (exigida pelo extensions.gnome.org).
