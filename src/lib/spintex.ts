// src/lib/spintex.ts
export class SpintexProcessor {
  /**
   * Processa texto com spintex, escolhendo aleatoriamente entre as opções
   * Ex: "{Olá|Oi|E aí}" -> "Oi" (aleatório)
   */
  static process(text: string): string {
    return text.replace(/\{([^}]+)\}/g, (match, content) => {
      const options = content.split('|').map((opt: string) => opt.trim());
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex];
    });
  }

  /**
   * Substitui variáveis no template
   * Ex: "{{nome}}" -> "João"
   */
  static replaceVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const value = variables[varName.trim()];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Processa texto completo: spintex + variáveis
   */
  static processTemplate(text: string, variables: Record<string, string> = {}): string {
    // Primeiro substitui as variáveis
    let processedText = this.replaceVariables(text, variables);
    // Depois processa o spintex
    processedText = this.process(processedText);
    return processedText;
  }

  /**
   * Gera múltiplas variações do template com spintex
   */
  static generateVariations(text: string, count: number = 10): string[] {
    const variations = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 5; // Evita loop infinito

    while (variations.size < count && attempts < maxAttempts) {
      const variation = this.process(text);
      variations.add(variation);
      attempts++;
    }

    return Array.from(variations);
  }

  /**
   * Extrai todas as variáveis de um template
   */
  static extractVariables(text: string): string[] {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];

    return [...new Set(matches.map(match =>
      match.replace(/\{\{|\}\}/g, '').trim()
    ))];
  }

  /**
   * Extrai todas as opções de spintex de um template
   */
  static extractSpintexOptions(text: string): Array<{
    original: string;
    options: string[];
    position: number;
  }> {
    const matches = [];
    const regex = /\{([^}]+)\}/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const options = match[1].split('|').map((opt: string) => opt.trim());
      matches.push({
        original: match[0],
        options,
        position: match.index
      });
    }

    return matches;
  }

  /**
   * Valida se todas as variáveis obrigatórias estão presentes
   */
  static validateVariables(
    text: string,
    providedVariables: Record<string, string>,
    requiredVariables: string[] = []
  ): { valid: boolean; missing: string[] } {
    const templateVariables = this.extractVariables(text);
    const allRequired = requiredVariables.length > 0 ? requiredVariables : templateVariables;

    const missing = allRequired.filter(variable =>
      !providedVariables[variable] || providedVariables[variable].trim() === ''
    );

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Valida se o template tem sintaxe spintex válida
   */
  static validateSpintexSyntax(text: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Chaves não balanceadas - verifique se todas as chaves { têm seu par }');
    }

    // Verifica se há spintex vazio
    if (text.includes('{}')) {
      errors.push('Spintex vazio encontrado - {}');
    }

    // Verifica se há opções vazias
    const emptyOptions = text.match(/\{[^}]*\|[\s]*\|[^}]*\}/g);
    if (emptyOptions) {
      errors.push('Opções vazias encontradas no spintex - evite usar || ou | no início/fim');
    }

    // Verifica spintex sem opções
    const noOptions = text.match(/\{[^|}]+\}/g);
    if (noOptions) {
      const singleOptions = noOptions.filter(match => !match.includes('|'));
      if (singleOptions.length > 0) {
        errors.push('Spintex sem opções alternativas encontrado - use | para separar opções');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Gera preview do template com variáveis de exemplo
   */
  static generatePreview(text: string, sampleVariables: Record<string, string> = {}): string {
    const variables = this.extractVariables(text);
    const exampleVars: Record<string, string> = {
      nome: "João Silva",
      produto: "Produto Exemplo",
      empresa: "Sua Empresa",
      desconto: "20",
      valor: "R$ 150,00",
      vencimento: "25/06/2025",
      link: "https://exemplo.com",
      data: new Date().toLocaleDateString(),
      hora: new Date().toLocaleTimeString(),
      email: "joao@exemplo.com",
      telefone: "(11) 99999-9999",
      cidade: "São Paulo",
      endereco: "Rua Exemplo, 123",
      codigo: "ABC123",
      pedido: "001234",
      ...sampleVariables
    };

    // Preenche variáveis que não têm exemplo
    variables.forEach(variable => {
      if (!exampleVars[variable]) {
        exampleVars[variable] = `[${variable}]`;
      }
    });

    return this.processTemplate(text, exampleVars);
  }

  /**
   * Conta o número de combinações possíveis no template
   */
  static countCombinations(text: string): number {
    const spintexOptions = this.extractSpintexOptions(text);

    if (spintexOptions.length === 0) return 1;

    return spintexOptions.reduce((total, option) => {
      return total * option.options.length;
    }, 1);
  }

  /**
   * Gera todas as combinações possíveis do template (cuidado com templates grandes)
   */
  static generateAllCombinations(text: string, maxCombinations: number = 100): string[] {
    const totalCombinations = this.countCombinations(text);

    if (totalCombinations > maxCombinations) {
      console.warn(`Template tem ${totalCombinations} combinações. Limitando a ${maxCombinations}.`);
      return this.generateVariations(text, maxCombinations);
    }

    const combinations = new Set<string>();
    const spintexOptions = this.extractSpintexOptions(text);

    if (spintexOptions.length === 0) {
      return [text];
    }

    // Gera todas as combinações usando recursão
    const generateRecursive = (currentText: string, optionIndex: number): void => {
      if (optionIndex >= spintexOptions.length) {
        combinations.add(currentText);
        return;
      }

      const option = spintexOptions[optionIndex];
      option.options.forEach(opt => {
        const newText = currentText.replace(option.original, opt);
        generateRecursive(newText, optionIndex + 1);
      });
    };

    generateRecursive(text, 0);
    return Array.from(combinations);
  }

  /**
   * Limpa o template removendo spintex e deixando apenas a primeira opção
   */
  static cleanTemplate(text: string): string {
    return text.replace(/\{([^}]+)\}/g, (match, content) => {
      const options = content.split('|').map((opt: string) => opt.trim());
      return options[0] || '';
    });
  }

  /**
   * Converte template simples em spintex adicionando variações
   */
  static convertToSpintex(text: string, synonyms: Record<string, string[]> = {}): string {
    const defaultSynonyms: Record<string, string[]> = {
      'olá': ['oi', 'e aí', 'ola'],
      'bom': ['ótimo', 'excelente', 'perfeito'],
      'dia': ['dia', 'tarde', 'período'],
      'obrigado': ['obrigado', 'valeu', 'muito obrigado'],
      'parabéns': ['parabéns', 'felicidades', 'sucesso'],
      'desconto': ['desconto', 'promoção', 'oferta'],
      'produto': ['produto', 'item', 'artigo'],
      'empresa': ['empresa', 'companhia', 'negócio'],
      'cliente': ['cliente', 'usuário', 'pessoa'],
      ...synonyms
    };

    let result = text;

    Object.entries(defaultSynonyms).forEach(([word, alternatives]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(result)) {
        const options = [word, ...alternatives].join('|');
        result = result.replace(regex, `{${options}}`);
      }
    });

    return result;
  }

  /**
   * Analisa a qualidade do spintex no template
   */
  static analyzeSpintexQuality(text: string): {
    score: number;
    recommendations: string[];
    stats: {
      totalSpintex: number;
      averageOptions: number;
      maxOptions: number;
      minOptions: number;
      combinations: number;
    };
  } {
    const spintexOptions = this.extractSpintexOptions(text);
    const recommendations: string[] = [];

    if (spintexOptions.length === 0) {
      return {
        score: 0,
        recommendations: ['Adicione spintex para criar variações da mensagem'],
        stats: {
          totalSpintex: 0,
          averageOptions: 0,
          maxOptions: 0,
          minOptions: 0,
          combinations: 1
        }
      };
    }

    const optionCounts = spintexOptions.map(opt => opt.options.length);
    const totalSpintex = spintexOptions.length;
    const averageOptions = optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length;
    const maxOptions = Math.max(...optionCounts);
    const minOptions = Math.min(...optionCounts);
    const combinations = this.countCombinations(text);

    let score = 0;

    // Pontuação baseada em critérios
    if (totalSpintex >= 3) score += 30;
    else if (totalSpintex >= 2) score += 20;
    else score += 10;

    if (averageOptions >= 3) score += 30;
    else if (averageOptions >= 2) score += 20;
    else score += 10;

    if (combinations >= 20) score += 25;
    else if (combinations >= 10) score += 15;
    else score += 5;

    if (minOptions >= 2) score += 15;
    else recommendations.push('Algumas opções de spintex têm apenas uma alternativa');

    if (combinations > 1000) {
      recommendations.push('Muitas combinações podem ser excessivas');
      score -= 10;
    }

    if (averageOptions < 2) {
      recommendations.push('Adicione mais opções para cada spintex');
    }

    if (totalSpintex < 3) {
      recommendations.push('Considere adicionar mais pontos de variação');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      recommendations,
      stats: {
        totalSpintex,
        averageOptions: Math.round(averageOptions * 100) / 100,
        maxOptions,
        minOptions,
        combinations
      }
    };
  }

  /**
   * Otimiza o template para melhor performance
   */
  static optimizeTemplate(text: string): {
    optimized: string;
    changes: string[];
  } {
    let optimized = text;
    const changes: string[] = [];

    // Remove espaços desnecessários
    const beforeSpaces = optimized;
    optimized = optimized.replace(/\{\s+/g, '{').replace(/\s+\}/g, '}');
    if (beforeSpaces !== optimized) {
      changes.push('Removidos espaços desnecessários em spintex');
    }

    // Remove opções duplicadas
    optimized = optimized.replace(/\{([^}]+)\}/g, (match, content) => {
      const options = content.split('|').map((opt: string) => opt.trim());
      const uniqueOptions = [...new Set(options)];
      if (uniqueOptions.length < options.length) {
        changes.push('Removidas opções duplicadas');
      }
      return `{${uniqueOptions.join('|')}}`;
    });

    // Remove opções vazias
    optimized = optimized.replace(/\{([^}]+)\}/g, (match, content) => {
      const options = content.split('|')
        .map((opt: string) => opt.trim())
        .filter(opt => opt.length > 0);

      if (options.length === 0) {
        changes.push('Removido spintex vazio');
        return '';
      }

      if (options.length === 1) {
        changes.push('Convertido spintex de opção única para texto normal');
        return options[0];
      }

      return `{${options.join('|')}}`;
    });

    return { optimized, changes };
  }
}
