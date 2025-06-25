// src/db/seeders/templates-seeder.ts
import { db } from "@/db";
import { templatesTables } from "@/db/schema";

const SYSTEM_TEMPLATES = [
  // Templates de Texto com Spintex
  {
    name: "Promoção Simples",
    description: "Template para promoções básicas com spintex",
    type: "text",
    category: "marketing",
    content: `{Olá|Oi|E aí} {{nome}}! 👋

{Temos uma|Temos|Preparamos uma} {oferta especial|promoção incrível|oportunidade única} para você!

🔥 {{produto}} com {até|desconto de} {{desconto}}% OFF

{Não perca|Aproveite|Garante já} esta {oportunidade|chance|promoção}!

{Link|Acesse|Clique}: {{link}}

{Dúvidas? Responda esta mensagem|Tem dúvidas? É só responder|Precisa de ajuda? Responda aqui}! 😊`,
    variables: ["nome", "produto", "desconto", "link"],
    requiredVariables: ["nome", "produto"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  },

  {
    name: "Boas-vindas",
    description: "Template de boas-vindas com variações",
    type: "text",
    category: "onboarding",
    content: `{Seja bem-vindo|Bem-vindo|Olá} {{nome}}! 🎉

{Que bom|Fico feliz|É um prazer} {ter você|tê-lo|conhecê-lo} {conosco|aqui|em nossa empresa}!

{Aqui você vai|Você poderá|Conosco você vai} {encontrar|descobrir|ter acesso a}:
• {Produtos de qualidade|Itens exclusivos|Soluções incríveis}
• {Atendimento personalizado|Suporte dedicado|Ajuda especializada}
• {Ofertas exclusivas|Promoções especiais|Descontos únicos}

{Qualquer dúvida|Precisa de ajuda|Tem alguma pergunta}? {Estou aqui|Conte comigo|É só chamar}! 💬`,
    variables: ["nome"],
    requiredVariables: ["nome"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  },

  {
    name: "Cobrança Amigável",
    description: "Template para cobrança educada com spintex",
    type: "text",
    category: "billing",
    content: `{Oi|Olá} {{nome}},

{Espero que esteja tudo bem|Tudo bem com você|Como vai}? 😊

{Estou entrando em contato|Vim falar com você|Queria conversar} sobre {sua fatura|o pagamento|a parcela} de {{valor}}.

{O vencimento foi|A data limite era|Passou do prazo} em {{vencimento}}.

{Poderia verificar|Pode dar uma olhada|Consegue checar} para mim? {Qualquer dificuldade|Se tiver algum problema|Caso precise de ajuda}, {estou aqui|me avise|pode falar comigo}.

{Obrigado|Agradeço|Valeu}! 🙏`,
    variables: ["nome", "valor", "vencimento"],
    requiredVariables: ["nome", "valor", "vencimento"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  },

  // Templates com Botões
  {
    name: "Pesquisa NPS",
    description: "Template de pesquisa de satisfação com botões",
    type: "button",
    category: "survey",
    content: `{Oi|Olá|E aí} {{nome}}! 😊

{Como foi|O que achou da|Gostaria de saber sobre a} sua experiência com {nosso atendimento|nossa empresa|nossos serviços}?

{Sua opinião|Seu feedback|O que você pensa} é {muito importante|fundamental|essencial} para nós!`,
    buttons: [
      {
        type: "reply",
        displayText: "😍 Excelente",
        id: "nps_10"
      },
      {
        type: "reply",
        displayText: "😊 Bom",
        id: "nps_8"
      },
      {
        type: "reply",
        displayText: "😐 Regular",
        id: "nps_6"
      }
    ],
    variables: ["nome"],
    requiredVariables: ["nome"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  },

  // Template de Lista
  {
    name: "Catálogo de Produtos",
    description: "Template de lista para mostrar produtos",
    type: "list",
    category: "catalog",
    content: `{Olá|Oi} {{nome}}! 👋

{Confira|Veja|Dê uma olhada em} nossos {produtos em destaque|itens mais vendidos|principais ofertas}:`,
    listSections: [
      {
        title: "Produtos em Destaque",
        rows: [
          {
            title: "{{produto1_nome}}",
            description: "{{produto1_desc}} - R$ {{produto1_preco}}",
            rowId: "produto_1"
          },
          {
            title: "{{produto2_nome}}",
            description: "{{produto2_desc}} - R$ {{produto2_preco}}",
            rowId: "produto_2"
          }
        ]
      }
    ],
    variables: ["nome", "produto1_nome", "produto1_desc", "produto1_preco", "produto2_nome", "produto2_desc", "produto2_preco"],
    requiredVariables: ["nome"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  },

  // Templates de Mídia
  {
    name: "Promoção com Imagem",
    description: "Template de promoção com imagem",
    type: "image",
    category: "marketing",
    content: `🔥 {OFERTA IMPERDÍVEL|PROMOÇÃO ESPECIAL|OPORTUNIDADE ÚNICA}! 🔥

{{nome}}, {não perca|aproveite|garanta já} esta {chance|oportunidade|promoção}!

{{produto}} com {{desconto}}% OFF

{Válido|Promoção válida|Oferta} até {{validade}}

{Peça já|Garanta o seu|Não deixe passar}! 🛒`,
    variables: ["nome", "produto", "desconto", "validade"],
    requiredVariables: ["nome", "produto"],
    isSystemTemplate: true,
    isActive: true,
    isApproved: true,
  }
];

export async function seedSystemTemplates(userId: string) {
  try {
    console.log("Inserindo templates do sistema...");

    for (const template of SYSTEM_TEMPLATES) {
      await db.insert(templatesTables).values({
        ...template,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }

    console.log(`${SYSTEM_TEMPLATES.length} templates inseridos com sucesso!`);
  } catch (error) {
    console.error("Erro ao inserir templates:", error);
    throw error;
  }
}
