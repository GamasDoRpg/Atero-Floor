# Atero Floor — Histórico de versões

## Editor v3 — interação e arquitetura

### Paredes

- Desenho por clique e clique ou por clique e arraste.
- Comprimento e ângulo aparecem durante o desenho.
- O comprimento também pode ser digitado e confirmado com `Enter`.
- Encaixe inteligente em 0°, 45° e 90°; `Shift` força incrementos de 45°.
- A medida de paredes existentes aparece durante o uso da ferramenta e quando elas são selecionadas.

### Seleção e movimentação

- `Shift + clique` adiciona ou remove elementos da seleção.
- Arrastar no vazio cria uma seleção por área.
- Duplo clique numa parede seleciona toda a cadeia de paredes conectadas.
- O painel de propriedades também oferece a ação **Selecionar conectadas**.
- Ao mover uma seleção, todas as paredes e elementos selecionados se deslocam juntos.
- Arrastar um vértice compartilhado move simultaneamente as extremidades de todas as paredes ligadas àquele ponto.

### Portas e janelas

- Portas e janelas não podem mais ocupar o mesmo trecho da parede.
- Quando o ponto clicado está ocupado, a abertura é deslocada ao espaço livre mais próximo.
- Alterações de largura e comprimento de parede são recusadas quando causariam sobreposição ou deixariam uma abertura fora da parede.
- Portas agora possuem duas propriedades independentes: lado da dobradiça e lado de abertura.
- As ações **Inverter dobradiça** e **Inverter lado** recalculam corretamente a folha e o arco da porta.

### Móveis

- Nova biblioteca de mobiliário com formas retangulares e elípticas.
- É possível criar móveis personalizados informando nome, largura, profundidade, formato e cor.
- Móveis personalizados ficam salvos no navegador em `atero-floor-custom-furniture-v1`.
- Móveis posicionados podem ter nome, dimensões, rotação, formato e cor editados.

### Escadas

- Nova ferramenta **Escada**.
- Clique e arraste para definir a área de uma escada reta.
- É possível editar nome, largura, comprimento, quantidade de degraus, rotação e sentido de subida.
- A planta mostra degraus e uma seta indicando o sentido.

### Compatibilidade

- Projetos existentes continuam usando o armazenamento local `atero-floor-projects-v1`.
- Portas e móveis de versões anteriores são normalizados ao abrir o projeto.
- O editor mantém salvamento automático, desfazer/refazer, múltiplos pavimentos e exportação em projeto, SVG e PNG.
