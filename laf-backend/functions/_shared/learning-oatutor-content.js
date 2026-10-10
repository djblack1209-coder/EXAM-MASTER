// OATutor / OpenStax content and marked Yozi adaptations: CC BY 4.0.
// This content license does not change the repository code license.
const pack = {
  id: 'oatutor-functions',
  version: 1,
  title: '函数运算带练',
  repository: 'https://github.com/CAHLR/OATutor-Content',
  revision: '1925decc91567faf6203bdb41b9d52b14891426f',
  historicalRevision: 'd2ede1e578adbb7406b72b90d64e1097ed67ac41',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  licensingEvidence: {
    publisherLicense:
      'https://github.com/openstax/osbooks-college-algebra-bundle/blob/33391c524272bd7db6fb6b246acad4d5a69b7df9/LICENSE',
    publisherLicenseSha256: '97d24386ff776d7160b87031b259a942bd03c9939796cab6724ad5d17d2cf785',
    oatutorStatement:
      'https://github.com/CAHLR/OATutor-Content/blob/1925decc91567faf6203bdb41b9d52b14891426f/README.md',
    basis:
      'Pinned historical CC BY 4.0 content and OATutor declaration; current OpenStax website terms are not used as blanket permission.'
  },
  attribution: {
    problem: 'Jay Abramson and contributing authors · OpenStax / Rice University · Precalculus',
    tutoring: 'OATutor Project',
    adaptation: 'Yozi AI：中文翻译、教学修正与定义域补充，沿用 CC BY 4.0；不表示原作者认可',
    url: 'https://openstax.org/books/precalculus/pages/1-4-composition-of-functions'
  },
  originals: {
    'content-pool/a005bd5real2/a005bd5real2.json': {
      sha256: 'a5aaa08d57a919562a3ba8a883f43f4f6bc3e25d56cbb59a824d3087e7529e95',
      content: {
        id: 'a005bd5real2',
        title: 'Solving Composition of Functions for a Defined f and g',
        body: '',
        variabilization: {},
        oer: 'https://openstax.org/books/precalculus/pages/1-4-composition-of-functions',
        license: 'https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>',
        lesson: '1.4 - Composition of Functions',
        lessonId: '51ukvlfX-chiP-S46rcW2BcC',
        courseName: 'OpenStax: Pre-Calculus'
      },
      priorSha256: 'ded9956390fba6f502cd3e78b4535a34b37447943ce3c948d68ffc715828444e'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2a/a005bd5real2a.json': {
      sha256: '90af1ce66c89fd3501951ec4b1788630e273cfe6c7651f424fd5bd4c193f8a08',
      content: {
        id: 'a005bd5real2a',
        stepAnswer: ['$$2x+6$$'],
        problemType: 'TextBox',
        stepTitle: 'Given $$f(x)=x^2+2x$$ and $$g(x)=6-x^2$$, find $$f+g$$.',
        stepBody: '',
        answerType: 'arithmetic',
        variabilization: {},
        answerLatex: '$$2x+6$$'
      },
      priorSha256: '90af1ce66c89fd3501951ec4b1788630e273cfe6c7651f424fd5bd4c193f8a08'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2a/tutoring/a005bd5real2aDefaultPathway.json': {
      sha256: '0dc7f3b0fd3d54a31650ffbc11509b45aaf2a5556e8c88ffe70195d19267e2d0',
      content: [
        {
          id: 'a005bd5real2a-h1',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'string',
          hintAnswer: ['(f+g)(x)=f(x)+g(x)'],
          dependencies: [],
          title: 'Addition of Functions',
          text: 'Give the formula for adding two functions.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2a-h2',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$x^2+2x+6-x^2$$'],
          dependencies: ['a005bd5real2a-h1'],
          title: 'Substitute',
          text: 'Plug in the given f(x) and g(x).',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2a-h3',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$x^2-x^2+2x+6$$'],
          dependencies: ['a005bd5real2a-h2'],
          title: 'Solve',
          text: 'Combine like terms.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2a-h4',
          type: 'hint',
          dependencies: ['a005bd5real2a-h3'],
          title: 'Simplify',
          text: '$$x^2$$ and $$x^2$$ cancel, so we are left with $$2x+6$$.',
          variabilization: {},
          oer: '',
          license: ''
        }
      ],
      priorSha256: '0dc7f3b0fd3d54a31650ffbc11509b45aaf2a5556e8c88ffe70195d19267e2d0'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2b/a005bd5real2b.json': {
      sha256: '88fc0b7b18e1fa1b9bc459f1ae9a821772db9d83d0595248e79bd42973a3a0b9',
      content: {
        id: 'a005bd5real2b',
        stepAnswer: ['$$2x^2+2x-6$$'],
        problemType: 'TextBox',
        stepTitle: 'Given $$f(x)=x^2+2x$$ and $$g(x)=6-x^2$$, find f-g.',
        stepBody: '',
        answerType: 'arithmetic',
        variabilization: {},
        answerLatex: '$$2x^2+2x-6$$'
      },
      priorSha256: '88fc0b7b18e1fa1b9bc459f1ae9a821772db9d83d0595248e79bd42973a3a0b9'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2b/tutoring/a005bd5real2bDefaultPathway.json': {
      sha256: '211e61c3e1e3ac9be5283ca25afc8efc3a4dce73f2f3aba857caf3e145e347d5',
      content: [
        {
          id: 'a005bd5real2b-h1',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'string',
          hintAnswer: ['(f-g)(x)=f(x)-g(x)'],
          dependencies: [],
          title: 'Difference of Functions',
          text: 'Give the formula for adding two functions.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2b-h2',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$x^2+2x-6-x^2$$'],
          dependencies: ['a005bd5real2b-h1'],
          title: 'Substitute',
          text: 'Plug in the given f(x) and g(x).',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2b-h3',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$x^2+2x-6-\\left(-x^2\\right)$$'],
          dependencies: ['a005bd5real2b-h2'],
          title: 'Solve',
          text: 'Distribute the negative sign.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2b-h3',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$x^2-\\left(-x^2\\right)+2x-6$$'],
          dependencies: ['a005bd5real2b-h2'],
          title: 'Solve',
          text: 'Combine like terms.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2b-h4',
          type: 'hint',
          dependencies: ['a005bd5real2b-h3'],
          title: 'Simplify',
          text: '$$x^2-\\left(-x^2\\right)=x^2+x^2=2x^2$$, so we are left with $$2x^2+2x-6$$.',
          variabilization: {},
          oer: '',
          license: ''
        }
      ],
      priorSha256: '211e61c3e1e3ac9be5283ca25afc8efc3a4dce73f2f3aba857caf3e145e347d5'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2c/a005bd5real2c.json': {
      sha256: '276aff63fa37d4e8367cf13a999b72a4c8772b082a1df175da0495b50778a4c9',
      content: {
        id: 'a005bd5real2c',
        stepAnswer: ['$$-x^4-2x^3+6x^2+12x$$'],
        problemType: 'TextBox',
        stepTitle: 'Given $$f(x)=x^2+2x$$ and $$g(x)=6-x^2$$, find fg.',
        stepBody: '',
        answerType: 'arithmetic',
        variabilization: {},
        answerLatex: '$$-x^4-2x^3+6x^2+12x$$'
      },
      priorSha256: '276aff63fa37d4e8367cf13a999b72a4c8772b082a1df175da0495b50778a4c9'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2c/tutoring/a005bd5real2cDefaultPathway.json': {
      sha256: '707a99b3f6ed43618e3537d00fb99db02c1d148ae4008da3dbeceabe63cb52fa',
      content: [
        {
          id: 'a005bd5real2c-h1',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$(fg)(x)=f{\\left(x\\right)} g{\\left(x\\right)}$$'],
          dependencies: [],
          title: 'Product of Functions',
          text: 'Give the formula for multiplying two functions.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2c-h2',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$\\left(x^2+2x\\right) \\left(6-x^2\\right)$$'],
          dependencies: ['a005bd5real2c-h1'],
          title: 'Substitute',
          text: 'Plug in the given f(x) and g(x).',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2c-h3',
          type: 'hint',
          dependencies: ['a005bd5real2c-h2'],
          title: 'Multiply',
          text: '$$\\left(x^2+2x\\right) \\left(6-x^2\\right)=x^2 \\left(6-x^2\\right)+2x \\left(6-x^2\\right)$$',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2c-h4',
          type: 'hint',
          dependencies: ['a005bd5real2c-h3'],
          title: 'Distribute',
          text: '$$x^2 \\left(6-x^2\\right)=6x^2-x^4$$ and $$2x \\left(6-x^2\\right)=12x-2x^3$$',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2c-h5',
          type: 'hint',
          dependencies: ['a005bd5real2c-h4'],
          title: 'Simplify',
          text: 'Putting it all together, we have $$6x^2-x^4+12x-2x^3$$',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2c-h6',
          type: 'hint',
          dependencies: ['a005bd5real2c-h5'],
          title: 'Simply',
          text: 'We have no like terms, so we will just reorder the degrees in descending order: $$-x^4-2x^3+6x^2+12x$$',
          variabilization: {},
          oer: '',
          license: ''
        }
      ],
      priorSha256: '707a99b3f6ed43618e3537d00fb99db02c1d148ae4008da3dbeceabe63cb52fa'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2d/a005bd5real2d.json': {
      sha256: '6b3f95d8ad5a561397027805f5cab9c5111b01e0630cbc9652c4543fc438146b',
      content: {
        id: 'a005bd5real2d',
        stepAnswer: ['$$\\frac{x^2+2x}{6-x^2}$$'],
        problemType: 'TextBox',
        stepTitle: 'Given $$f(x)=x^2+2x$$ and $$g(x)=6-x^2$$, find $$\\frac{f}{g}$$.',
        stepBody: '',
        answerType: 'arithmetic',
        variabilization: {},
        answerLatex: '$$\\frac{x^2+2x}{6-x^2}$$'
      },
      priorSha256: '6b3f95d8ad5a561397027805f5cab9c5111b01e0630cbc9652c4543fc438146b'
    },
    'content-pool/a005bd5real2/steps/a005bd5real2d/tutoring/a005bd5real2dDefaultPathway.json': {
      sha256: 'e516228944bf66a1067d5c4d4d9a51b77ce63964fae2ecd97d4d3a3ac86396fd',
      content: [
        {
          id: 'a005bd5real2d-h1',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'string',
          hintAnswer: ['(f/g)(x)=f(x)/g(x)'],
          dependencies: [],
          title: 'Division of Functions',
          text: 'Give the formula for dividing two functions.',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2d-h2',
          type: 'scaffold',
          problemType: 'TextBox',
          answerType: 'arithmetic',
          hintAnswer: ['$$\\frac{x^2+2x}{6-x^2}$$'],
          dependencies: ['a005bd5real2d-h1'],
          title: 'Substitute',
          text: 'Plug in the given f(x) and g(x).',
          variabilization: {},
          oer: '',
          license: ''
        },
        {
          id: 'a005bd5real2d-h3',
          type: 'scaffold',
          problemType: 'MultipleChoice',
          answerType: 'string',
          hintAnswer: ['No'],
          dependencies: ['a005bd5real2d-h2'],
          title: 'Reasoning',
          text: 'Can we factor or divide either function?',
          variabilization: {},
          oer: '',
          license: '',
          choices: ['Yes', 'No']
        }
      ],
      priorSha256: 'f5e08cfe522b83a7ea8e92d57ec55cde1915d07d604812b2992fe06282e7f180'
    }
  },
  items: [
    {
      id: 'sum',
      label: '函数相加',
      stepId: 'a005bd5real2a',
      prompt: '已知 f(x)=x²+2x，g(x)=6−x²，求 (f+g)(x)。',
      answer: '(f+g)(x)=2x+6。',
      changes: ['翻译为中文并统一公式显示。', '末条明确为 x² 与 −x² 相消，修正原文漏写负号。'],
      nodes: [
        {
          id: '1',
          upstreamIndex: 0,
          type: 'scaffold',
          title: '写出关系',
          prompt: '先用 f(x) 和 g(x) 写出 (f+g)(x)。',
          reference: '(f+g)(x)=f(x)+g(x)。',
          dependencies: []
        },
        {
          id: '2',
          upstreamIndex: 1,
          type: 'scaffold',
          title: '代入',
          prompt: '将 f(x)=x²+2x、g(x)=6−x² 代入相加的关系式。',
          reference: '(f+g)(x)=(x²+2x)+(6−x²)。',
          dependencies: ['1']
        },
        {
          id: '3',
          upstreamIndex: 2,
          type: 'scaffold',
          title: '合并同类项',
          prompt: '将上式中的同类项放在一起。',
          reference: 'x²−x²+2x+6。',
          dependencies: ['2']
        },
        {
          id: '4',
          upstreamIndex: 3,
          type: 'hint',
          title: '化简',
          prompt: 'x² 与 −x² 相消，剩下 2x+6。',
          reference: null,
          dependencies: ['3']
        }
      ]
    },
    {
      id: 'difference',
      label: '函数相减',
      stepId: 'a005bd5real2b',
      prompt: '已知 f(x)=x²+2x，g(x)=6−x²，求 (f−g)(x)。',
      answer: '(f−g)(x)=2x²+2x−6。',
      changes: [
        '翻译为中文并统一公式显示。',
        '将第一步误写的加法改为减法。',
        '代入步骤保留减号后的括号，修正原参考漏分配负号。',
        '保留两个原 h3 的内容，分别映射为第3/4步并串联依赖，消除编号冲突。'
      ],
      nodes: [
        {
          id: '1',
          upstreamIndex: 0,
          type: 'scaffold',
          title: '写出关系',
          prompt: '先用 f(x) 和 g(x) 写出 (f−g)(x)。',
          reference: '(f−g)(x)=f(x)−g(x)。',
          dependencies: []
        },
        {
          id: '2',
          upstreamIndex: 1,
          type: 'scaffold',
          title: '代入',
          prompt: '把两个函数代入，先保留减号后的括号。',
          reference: '(f−g)(x)=(x²+2x)−(6−x²)。',
          dependencies: ['1']
        },
        {
          id: '3',
          upstreamIndex: 2,
          type: 'scaffold',
          title: '去括号',
          prompt: '去掉第二个括号后，写出各项。',
          reference: 'x²+2x−6+x²。',
          dependencies: ['2']
        },
        {
          id: '4',
          upstreamIndex: 3,
          type: 'scaffold',
          title: '合并同类项',
          prompt: '将平方项放在一起。',
          reference: 'x²+x²+2x−6。',
          dependencies: ['3']
        },
        {
          id: '5',
          upstreamIndex: 4,
          type: 'hint',
          title: '化简',
          prompt: 'x²+x²=2x²，得到 2x²+2x−6。',
          reference: null,
          dependencies: ['4']
        }
      ]
    },
    {
      id: 'product',
      label: '函数相乘',
      stepId: 'a005bd5real2c',
      prompt: '已知 f(x)=x²+2x，g(x)=6−x²，求 (fg)(x)。',
      answer: '(fg)(x)=−x⁴−2x³+6x²+12x。',
      changes: ['翻译为中文并统一公式显示；保留原依赖次序。'],
      nodes: [
        {
          id: '1',
          upstreamIndex: 0,
          type: 'scaffold',
          title: '写出关系',
          prompt: '先用 f(x) 和 g(x) 写出 (fg)(x)。',
          reference: '(fg)(x)=f(x)g(x)。',
          dependencies: []
        },
        {
          id: '2',
          upstreamIndex: 1,
          type: 'scaffold',
          title: '代入',
          prompt: '写出两个函数式相乘的形式。',
          reference: '(x²+2x)(6−x²)。',
          dependencies: ['1']
        },
        {
          id: '3',
          upstreamIndex: 2,
          type: 'hint',
          title: '分配',
          prompt: '(x²+2x)(6−x²)=x²(6−x²)+2x(6−x²)。',
          reference: null,
          dependencies: ['2']
        },
        {
          id: '4',
          upstreamIndex: 3,
          type: 'hint',
          title: '展开',
          prompt: 'x²(6−x²)=6x²−x⁴；2x(6−x²)=12x−2x³。',
          reference: null,
          dependencies: ['3']
        },
        {
          id: '5',
          upstreamIndex: 4,
          type: 'hint',
          title: '合并',
          prompt: '把展开的结果放在一起：6x²−x⁴+12x−2x³。',
          reference: null,
          dependencies: ['4']
        },
        {
          id: '6',
          upstreamIndex: 5,
          type: 'hint',
          title: '整理',
          prompt: '按次数从高到低写为 −x⁴−2x³+6x²+12x。',
          reference: null,
          dependencies: ['5']
        }
      ]
    },
    {
      id: 'quotient',
      label: '函数相除',
      stepId: 'a005bd5real2d',
      prompt: '已知 f(x)=x²+2x，g(x)=6−x²，求 (f/g)(x)，并写出实数定义域。',
      answer: '(f/g)(x)=(x²+2x)/(6−x²)，x≠−√6 且 x≠√6。',
      changes: [
        '翻译为中文并统一公式显示。',
        '第三步改为检查可约去的公因式；分子可分解为 x(x+2)，不再沿用原笼统的不能因式分解。',
        '新增分母不为零的定义域步骤及最终参考范围。'
      ],
      nodes: [
        {
          id: '1',
          upstreamIndex: 0,
          type: 'scaffold',
          title: '写出关系',
          prompt: '先用 f(x) 和 g(x) 写出 (f/g)(x)。',
          reference: '(f/g)(x)=f(x)/g(x)，且 g(x)≠0。',
          dependencies: []
        },
        {
          id: '2',
          upstreamIndex: 1,
          type: 'scaffold',
          title: '代入',
          prompt: '写出代入后的分式。',
          reference: '(x²+2x)/(6−x²)。',
          dependencies: ['1']
        },
        {
          id: '3',
          upstreamIndex: 2,
          type: 'scaffold',
          title: '检查约分',
          prompt: '分子 x(x+2) 与分母 6−x² 有可约去的非平凡公因式吗？说明理由。',
          reference: '没有。分子为零时 x=0 或 −2，此时分母分别为6或2，均不为零。',
          dependencies: ['2']
        },
        {
          id: '4',
          upstreamIndex: null,
          type: 'scaffold',
          title: '定义域',
          prompt: '分母不能等于零，因此应排除哪些实数？',
          reference: '6−x²=0 的解为 x=−√6 或 √6，定义域排除这两个值。',
          dependencies: ['3']
        }
      ]
    }
  ],
  gradingAuthority: false
};
export const oatutorContent = () => JSON.parse(JSON.stringify(pack));
