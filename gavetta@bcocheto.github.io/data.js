// Dados estáticos das abas Emoji, Kaomoji e Símbolos.
// Formato de cada linha: "glifo|palavras-chave para busca (pt-BR)"

const parse = (name, icon, text) => ({
    name,
    icon,
    items: text.trim().split('\n').map(l => {
        const [glyph, ...kw] = l.split('|');
        return {glyph: glyph.trim(), kw: kw.join('|').toLowerCase()};
    }),
});

export const EMOJI = [
    parse('Rostos', '😀', `
😀|sorriso feliz rosto
😃|sorriso olhos grandes alegre
😄|sorriso olhos felizes
😁|sorriso dentes animado
😆|rindo gargalhada
😅|suor riso alivio
🤣|rolando de rir kkk
😂|chorando de rir lol
🙂|sorriso leve
🙃|de cabeca para baixo ironia
😉|piscadinha
😊|corado sorriso fofo
😇|anjo santo halo
🥰|apaixonado coracoes amor
😍|olhos de coracao amei
🤩|deslumbrado estrelas uau
😘|beijo coracao
😗|beijinho
😚|beijo olhos fechados
😋|delicioso saboroso gostoso
😛|lingua
😜|lingua piscadinha maluco
🤪|doido louco
😝|lingua olhos fechados
🤑|dinheiro rico
🤗|abraco
🤭|mao na boca ops
🤫|silencio shhh
🤔|pensando duvida hmm
🤐|boca fechada ziper segredo
🤨|sobrancelha duvida desconfiado
😐|neutro sem expressao
😑|sem emocao
😶|sem boca
😏|malicioso sorrisinho
😒|desdenho tedio
🙄|revirando olhos
😬|constrangido dentes
😮‍💨|suspiro alivio
🤥|mentiroso pinoquio
😌|aliviado calmo
😔|pensativo triste
😪|sonolento
🤤|babando
😴|dormindo sono zzz
😷|mascara doente
🤒|termometro febre doente
🤕|machucado curativo
🤢|enjoado nausea
🤮|vomitando
🤧|espirro
🥵|calor quente
🥶|frio congelado
🥴|tonto zonzo
😵|tontura
🤯|cabeca explodindo mente
🤠|cowboy
🥳|festa comemorando aniversario
😎|oculos escuros legal
🤓|nerd
🧐|monoculo investigando
😕|confuso
😟|preocupado
🙁|triste leve
☹️|triste
😮|surpreso boca aberta
😲|chocado
😳|envergonhado corado
🥺|suplicando pidao carinha
😦|aflito
😨|assustado medo
😰|ansioso suor frio
😥|triste aliviado
😢|chorando lagrima
😭|chorando muito soluco
😱|gritando susto horror
😖|frustrado
😣|perseverando
😞|decepcionado
😓|suor frio
😩|cansado exausto
😫|exausto
🥱|bocejo tedio
😤|bufando raiva
😡|bravo raiva vermelho
😠|zangado
🤬|xingando palavrao
😈|diabinho sorrindo
👿|diabinho bravo
💀|caveira morri
☠️|caveira ossos perigo
💩|coco cocozinho
🤡|palhaco
👻|fantasma
👽|alien extraterrestre
🤖|robo
🎃|abobora halloween
`),
    parse('Gestos e pessoas', '👍', `
👍|joinha positivo ok
👎|negativo nao gostei
👌|ok perfeito
🤌|dedos juntos italiano
✌️|paz vitoria
🤞|dedos cruzados sorte
🤟|te amo
🤘|rock
🤙|ligue-me hang loose
👈|apontando esquerda
👉|apontando direita
👆|apontando cima
👇|apontando baixo
☝️|indicador cima
✋|mao parar
🖐️|mao aberta
🖖|vulcano spock
👋|tchau oi aceno
🤚|costas da mao
👏|palmas aplausos
🙌|maos para cima celebrar
👐|maos abertas
🤲|maos em concha
🤝|aperto de mao acordo
🙏|obrigado por favor rezar
✍️|escrevendo
💅|unhas esmalte
💪|forca braco musculo
🦾|braco robotico
👀|olhos olhando
👁️|olho
🧠|cerebro
🫀|coracao anatomico
👶|bebe
👦|menino
👧|menina
👨|homem
👩|mulher
🧑|pessoa
👴|idoso
👵|idosa
🙋|mao levantada
🤷|nao sei de ombros
🤦|facepalm
🙇|reverencia
💃|danca mulher
🕺|danca homem
🏃|correndo
🚶|andando
👨‍💻|programador desenvolvedor homem
👩‍💻|programadora desenvolvedora mulher
🧑‍💻|tecnologo desenvolvedor
`),
    parse('Animais e natureza', '🐶', `
🐶|cachorro cao
🐱|gato
🐭|rato
🐹|hamster
🐰|coelho
🦊|raposa
🐻|urso
🐼|panda
🐨|coala
🐯|tigre
🦁|leao
🐮|vaca
🐷|porco
🐸|sapo
🐵|macaco
🙈|macaco nao vejo
🙉|macaco nao ouco
🙊|macaco nao falo
🐔|galinha
🐧|pinguim
🐦|passaro
🦅|aguia
🦉|coruja
🐺|lobo
🐴|cavalo
🦄|unicornio
🐝|abelha
🐛|inseto lagarta bug
🦋|borboleta
🐌|caracol
🐞|joaninha
🐢|tartaruga
🐍|cobra
🐙|polvo
🦀|caranguejo
🐠|peixe
🐬|golfinho
🐳|baleia
🦈|tubarao
🐘|elefante
🦒|girafa
🌵|cacto
🌲|arvore pinheiro
🌳|arvore
🌴|palmeira
🌱|muda planta
🌿|folha erva
🍀|trevo sorte
🍁|folha bordo outono
🌸|flor de cerejeira
🌹|rosa
🌻|girassol
🌞|sol rosto
🌙|lua
⭐|estrela
🌈|arco-iris
☀️|sol
☁️|nuvem
🌧️|chuva
⚡|raio energia
🔥|fogo quente
💧|gota agua
🌊|onda mar
❄️|neve floco
`),
    parse('Comida', '🍕', `
🍎|maca
🍊|laranja tangerina
🍋|limao
🍌|banana
🍉|melancia
🍇|uva
🍓|morango
🍒|cereja
🍑|pessego
🥭|manga
🍍|abacaxi
🥥|coco
🥑|abacate
🍅|tomate
🥕|cenoura
🌽|milho
🥔|batata
🍞|pao
🥐|croissant
🥖|baguete
🧀|queijo
🍳|ovo frito
🥓|bacon
🍔|hamburguer
🍟|batata frita
🍕|pizza
🌭|cachorro-quente
🥪|sanduiche
🌮|taco
🌯|burrito
🍝|macarrao espaguete
🍣|sushi
🍜|lamen sopa
🍰|bolo fatia
🎂|bolo aniversario
🍩|rosquinha donut
🍪|biscoito cookie
🍫|chocolate
🍬|bala doce
🍦|sorvete
🍿|pipoca
☕|cafe
🍵|cha
🥤|refrigerante copo
🍺|cerveja
🍻|brinde cervejas
🍷|vinho
🥂|brinde taca
🍾|champanhe garrafa
🥃|whisky
`),
    parse('Atividades e viagens', '⚽', `
⚽|futebol bola
🏀|basquete
🏈|futebol americano
⚾|beisebol
🎾|tenis
🏐|volei
🏓|ping pong
🥊|boxe luva
🎯|alvo dardo
🎮|videogame controle
🎲|dado jogo
🧩|quebra-cabeca
🎸|guitarra
🎹|piano teclado
🥁|bateria
🎤|microfone
🎧|fone de ouvido musica
🎬|claquete cinema
🎨|paleta arte pintura
🏆|trofeu campeao
🥇|medalha ouro primeiro
🚗|carro
🚕|taxi
🚌|onibus
🚓|viatura policia
🚑|ambulancia
🚒|bombeiro
🚲|bicicleta
🛵|moto lambreta
✈️|aviao viagem
🚀|foguete lancamento
🚁|helicoptero
🚢|navio
⛵|veleiro
🏠|casa
🏢|predio escritorio
🏖️|praia
🏝️|ilha
🌍|mundo africa europa
🌎|mundo americas
🗺️|mapa
🧭|bussola
⛺|barraca acampamento
🗽|estatua da liberdade
🎡|roda gigante
🎢|montanha russa
`),
    parse('Objetos', '💡', `
⌚|relogio
📱|celular
💻|notebook laptop computador
⌨️|teclado
🖥️|desktop computador monitor
🖱️|mouse
💾|disquete salvar
💿|cd
📷|camera
📹|filmadora
📺|televisao
📻|radio
☎️|telefone
🔋|bateria
🔌|tomada plugue
💡|lampada ideia
🔦|lanterna
💸|dinheiro voando
💰|saco de dinheiro
💳|cartao de credito
💎|diamante joia
🔧|chave inglesa ferramenta
🔨|martelo
🛠️|ferramentas
⚙️|engrenagem configuracoes
🔩|parafuso porca
🔗|link corrente
📎|clipe anexo
📌|alfinete fixar
📍|localizacao pino
✂️|tesoura
📏|regua
📝|nota memorando escrever
📄|documento pagina
📚|livros
📖|livro aberto
📒|caderno
📅|calendario
📆|calendario data
📊|grafico barras
📈|grafico subindo crescimento
📉|grafico caindo queda
📁|pasta
📂|pasta aberta
🗂️|divisorias arquivos
🗑️|lixeira apagar
📦|caixa pacote
✉️|envelope email
📧|email
📨|mensagem recebida
📣|megafone
📢|alto-falante aviso
🔔|sino notificacao
🔕|sino silenciado
🔒|cadeado fechado seguro
🔓|cadeado aberto
🔑|chave
🔍|lupa busca
🔎|lupa direita busca
🧪|tubo de ensaio teste
🧬|dna
🔬|microscopio
🔭|telescopio
💊|remedio pilula
🩺|estetoscopio
🧹|vassoura limpar
🧯|extintor
🎁|presente
🎈|balao
🎉|confete festa parabens
🎊|bola de confete
`),
    parse('Símbolos', '❤️', `
❤️|coracao vermelho amor
🧡|coracao laranja
💛|coracao amarelo
💚|coracao verde
💙|coracao azul
💜|coracao roxo
🖤|coracao preto
🤍|coracao branco
💔|coracao partido
❣️|exclamacao coracao
💕|dois coracoes
💞|coracoes girando
💓|coracao batendo
💗|coracao crescendo
💖|coracao brilhante
💘|coracao flecha cupido
💯|cem pontos perfeito
💢|raiva
💥|colisao explosao
💫|tontura estrelas
💦|gotas suor
💨|correndo vento
✨|brilhos magia
🌟|estrela brilhante
💬|balao de fala
💭|balao de pensamento
✅|ok verificado feito
❌|errado x cancelar
❎|x verde
⭕|circulo vermelho
❓|interrogacao pergunta
❗|exclamacao atencao
‼️|dupla exclamacao
⚠️|aviso atencao perigo
🚫|proibido
⛔|entrada proibida
🔴|circulo vermelho
🟠|circulo laranja
🟡|circulo amarelo
🟢|circulo verde
🔵|circulo azul
🟣|circulo roxo
⚫|circulo preto
⚪|circulo branco
➕|mais adicionar
➖|menos
✖️|multiplicar
➗|dividir
♻️|reciclar
🔄|atualizar setas
🔁|repetir
▶️|play tocar
⏸️|pausar
⏹️|parar
⏩|avancar
⏪|voltar
⬆️|seta cima
⬇️|seta baixo
⬅️|seta esquerda
➡️|seta direita
🆗|ok
🆕|novo
🆓|gratis free
🔝|topo
🔜|em breve soon
🇧🇷|bandeira brasil
🏳️‍🌈|bandeira arco-iris orgulho
🏴‍☠️|bandeira pirata
🚩|bandeira vermelha
🏁|bandeira quadriculada chegada
`),
];

export const KAOMOJI = [
    parse('Alegria', ':-)', `
(＾▽＾)|feliz alegre sorriso
(◕‿◕)|fofo feliz
(≧▽≦)|animado muito feliz
(*^‿^*)|corado feliz
ヽ(•‿•)ノ|alegre comemorando
＼(^o^)／|celebrando bracos para cima
(๑˃ᴗ˂)ﻭ|torcida animado
(⌒‿⌒)|sorriso leve
٩(◕‿◕)۶|animado fofo
(✿◠‿◠)|flor fofo
(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧|brilho magia feliz
♪(´▽｀)|musica cantando
`),
    parse('Tristeza e raiva', ':-(', `
(╥﹏╥)|chorando triste
(T_T)|chorando
(ಥ_ಥ)|lagrimas emocionado
(；︵；)|triste
(╯°□°)╯︵ ┻━┻|mesa virando raiva
┬─┬ノ( º _ ºノ)|colocando a mesa de volta calma
(ノಠ益ಠ)ノ彡┻━┻|furia mesa
(ಠ_ಠ)|desaprovacao olhar
(¬_¬)|desconfiado olhar de lado
(；一_一)|cansado tedio
(︶︹︺)|desanimado
(－_－) zzZ|dormindo sono
`),
    parse('Divertidos', ';-)', `
¯\\_(ツ)_/¯|de ombros nao sei shrug
( ͡° ͜ʖ ͡°)|lenny malicioso
(づ｡◕‿‿◕｡)づ|abraco
(☞ﾟヮﾟ)☞|apontando
☜(ﾟヮﾟ☜)|apontando
(•_•) ( •_•)>⌐■-■ (⌐■_■)|oculos deal with it
(☉_☉)|olhos arregalados surpresa
(⊙_⊙)|chocado
ʕ•ᴥ•ʔ|urso fofo
(=^･ω･^=)|gato
(◍•ᴗ•◍)❤|amor
(づ￣ ³￣)づ|beijo
(ง'̀-'́)ง|lutando vamos
(•̀ᴗ•́)و|determinado
`),
];

export const SYMBOLS = [
    parse('Gerais', '©', `
©|copyright direitos autorais
®|registrado marca
™|marca registrada trademark
§|secao paragrafo
¶|paragrafo
†|adaga cruz
•|marcador bolinha
·|ponto medio
…|reticencias
–|travessao en
—|travessao em
«|aspas francesas esquerda
»|aspas francesas direita
“|aspas esquerda
”|aspas direita
‘|aspa simples esquerda
’|aspa simples direita
°|grau
№|numero
✓|check certo
✗|errado x
★|estrela cheia
☆|estrela vazia
♥|coracao
♦|losango
♣|paus
♠|espadas
☺|rosto sorrindo
☼|sol
♪|nota musical
♫|notas musicais
`),
    parse('Setas', '→', `
←|seta esquerda
→|seta direita
↑|seta cima
↓|seta baixo
↔|seta esquerda direita
↕|seta cima baixo
↖|seta diagonal
↗|seta diagonal
↘|seta diagonal
↙|seta diagonal
⇐|seta dupla esquerda
⇒|seta dupla direita implica
⇔|seta dupla equivalente
↩|retorno
↪|retorno direita
⟲|rotacao anti-horaria
⟳|rotacao horaria
➜|seta pesada
➤|seta ponta
`),
    parse('Matemática', '∑', `
±|mais ou menos
×|multiplicacao vezes
÷|divisao
≠|diferente
≈|aproximadamente
≤|menor ou igual
≥|maior ou igual
∞|infinito
√|raiz quadrada
∑|somatorio
∏|produto
∫|integral
∂|derivada parcial
∆|delta variacao
π|pi
Ω|omega ohm
µ|micro mu
α|alfa
β|beta
γ|gama
θ|teta
λ|lambda
σ|sigma
¼|um quarto
½|meio metade
¾|tres quartos
²|ao quadrado
³|ao cubo
‰|por mil
∈|pertence
∅|vazio conjunto
∩|interseccao
∪|uniao
`),
    parse('Moedas', '$', `
$|dolar
€|euro
£|libra
¥|iene yuan
₿|bitcoin
₹|rupia
₩|won
₽|rublo
¢|centavo
R$|real brasileiro reais
₡|colon
₪|shekel
₫|dong
₴|grivna
`),
    parse('Latinos', 'é', `
á|a agudo
à|a crase
â|a circunflexo
ã|a til
ä|a trema
é|e agudo
ê|e circunflexo
í|i agudo
ó|o agudo
ô|o circunflexo
õ|o til
ú|u agudo
ü|u trema
ç|c cedilha
ñ|n til
ß|eszett
ø|o cortado
å|a anel
æ|ae ligadura
œ|oe ligadura
¿|interrogacao invertida
¡|exclamacao invertida
ª|ordinal feminino
º|ordinal masculino
`),
];
