#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 政治-2025.json 闪卡数据质量问题
"""

import json
import re
import copy

INPUT_FILE = "src/config/flashcard-banks/politics-2025.json"
OUTPUT_FILE = "src/config/flashcard-banks/politics-2025.json"

# 正确答案表
ANSWERS = {
    1: "C", 2: "B", 3: "D", 4: "C", 5: "B", 6: "C", 7: "A", 8: "D",
    9: "A", 10: "B", 11: "A", 12: "A", 13: "B", 14: "C", 15: "D", 16: "D",
    17: "CD", 18: "AD", 19: "ABC", 20: "ABD", 21: "BCD", 22: "BCD", 23: "ABD",
    24: "ABCD", 25: "ABC", 26: "ACD", 27: "AD", 28: "AC", 29: "ACD", 30: "ACD",
    31: "BD", 32: "ABCD", 33: "ABC",
}

# 正确的解析文本
EXPLANATIONS = {
    1: '本题考查辩证思维能力。\u201c既要\u2026\u2026又要\u2026\u2026\u201d、多元体系、大食物观，这些题眼都体现了系统观念与系统思维能力，所以选C。',
    2: 'A选项为笛卡尔的主观唯心主义，C选项错在\u201c各个具体环节\u201d，D选项错在\u201c拒斥\u201d这个词。所以本题正确答案是B。',
    3: 'A选项错在\u201c同等重要\u201d，B选项错在\u201c改变方向\u201d。C选项说法不严谨，故选D。',
    4: 'A选项错在\u201c已经形成\u201d，B选项错在资本主义不能为社会主义创造条件，D选项\u201c正相关性\u201d不严谨。故选C。',
    5: '毛泽东在《反对本本主义》一文中指出\u201c中国革命斗争的胜利要靠中国同志了解中国情况\u201d，主要是为了反对党内存在的教条主义倾向。故选B。',
    6: '解决问题的依据是把握国情，故选C。为建设中国特色社会主义提供总依据的是我国的基本国情理论，所以C选项社会主义初级阶段理论是正确答案。',
    7: '新时代这一主体性最有力的体现是创立习近平新时代中国特色社会主义思想。故正确答案是A选项。',
    8: '制度型开放是高水平对外开放的重要标志，所以当前我国的高水平对外开放主要是指制度型开放。故选D。',
    9: '新时代加强社会建设的重要着力点是健全和完善社会保障体系。其余选项不符合题意。故A正确。',
    10: '帝国主义和封建主义相互勾结，残酷地压迫和掠夺中国人民，严重地阻碍着中国社会的发展。中国革命主要任务是推翻帝国主义压迫的民族革命和推翻封建地主压迫的民主革命。所以，本题正确答案为选项B。',
    11: '近代以来中华民族面临的两大历史任务，就是争取民族独立、人民解放和实现国家富强、人民富裕。前一个任务为后一个任务扫除障碍，创造必要的前提。近代中国\u201c实业救国\u201d走不通，是因为民族独立和人民解放尚未实现。所以，本题正确答案为选项A。',
    12: '中共七大将毛泽东思想确立为党的指导思想并写入党章，是中共七大的历史性贡献。B选项是中共二大提出的，C选项是中共二大提出的，D选项是古田会议提出的。故选A。',
    13: '全会指出：党和国家工作的重点必须转移到以经济建设为中心的社会主义现代化建设上来，党的各项工作都必须服从和服务于经济建设这个中心。A选项是七届二中全会的内容，C选项是一五计划的内容，D选项过于绝对。所以，本题正确答案为选项B。',
    14: 'A选项生命健康权属于人身权利，是维持生命存在的权利；B选项民主管理权属于政治权利；D选项通信自由权也是人身权利。这三项都和隐私无关。隐私属于人格尊严权，人格尊严的基本内容有姓名权、肖像权、名誉权、荣誉权、隐私权等。故选C。',
    15: '中共二十届三中全会通过的《决定》指出，教育、科技、人才是中国式现代化的基础性、战略性支撑。因此选D项。高水平社会主义市场经济体制是中国式现代化的重要保障。ABC不符合题意。',
    16: '二十国集团成员在2023年9月已邀请非洲联盟成为正式成员，故A项是错误的。B项在2023年也已经提出，C项在2022年已经出现。习近平指出中方愿同非方建立落实全球安全倡议伙伴关系，打造倡议合作示范区，故D项是正确的。',
    17: 'A选项错在\u201c纯粹\u201d。B选项错在\u201c决定\u201d，因为规律具有客观性，不以人的意志为转移。所以，本题正确答案是选项CD。',
    18: 'B选项错在\u201c代替\u201d，C选项错在\u201c取代\u201d。因为人工智能不能代替人的意识，也不能取代人类社会交往的真情实感。所以本题正确答案是AD。',
    19: '在价值关系中，人的需要、兴趣、目的是随着社会环境的改变而改变的，所以通过人的实践而实现的价值也处在不断变化之中。D选项属于客观主义价值论。所以本题正确答案是ABC。',
    20: 'ABD选项都是劳动产品，但不是商品。C选项为获取利润而生产的农产品是商品，本题考查的是劳动产品而非商品。所以正确答案ABD。',
    21: 'A选项\u201c资本主义生产资料所有制性质发生根本变化\u201d说法错误，不选。BCD选项都符合题意。',
    22: '马克思主义中国化的理论成果是一脉相承又与时俱进，表现在都贯穿实事求是、群众路线、独立自主的立场观点方法，都科学回答了时代提出的重大理论和实践课题，都以独创性的理论成果丰富和发展了马克思主义。但是它们面临的时代主题和历史任务不同，A选项排除。所以本题答案是BCD。',
    23: '民营经济的迅速发展充分说明非公有制经济发展的政策制度环境不断优化，促进非公有制经济发展壮大的体制机制不断完善，非公有制经济发展活力不断提升。非公有制经济在国民经济中不起主导作用，C选项排除。所以本题正确答案是ABD。',
    24: '设立基层立法联系点有利于健全汇集民智工作机制，完善民意表达平台和载体，践行全过程人民民主，丰富中国特色社会主义民主形式。所以本题ABCD全选。',
    25: '推动废弃物循环利用有利于形成节约集约循环利用的资源观，转变资源利用方式，提高资源利用效率，实现生产系统和生活系统循环链接。D选项\u201c科学推进水土流失综合治理\u201d虽然说法正确，但未体现推动废弃物循环利用。所以本题的正确答案是ABC。',
    26: '文化之所以能够成为推动高质量发展的重要支点，是因为文化能为经济社会发展提供价值指引和精神力量，文化融入经济活动有助于激活发展动能、提升发展品质，文化繁荣有助于促进社会创新创造的活力动力。文化建设不是解决新时代我国社会主要矛盾的根本途径。所以本题正确答案是ACD。',
    27: '中国共产党成立具有重要的历史特点。一方面，它是在半殖民地半封建中国的工人运动基础上产生的。另一方面，它成立于俄国十月革命取得胜利之后，接受了没有被修正主义阉割的马克思主义。B选项应该是\u201c工人运动\u201d而非\u201c农民运动\u201d的基础上产生的党，C选项中共不是一开始就重视与其它党派的合作，故排除。正确答案AD。',
    28: '六届六中全会第一次提出\u201c马克思主义中国化\u201d命题，基本上克服了王明的右倾错误，统一了全党的思想和步调。B选项是七届二中全会提出的，D选项是古田会议提出的，故排除。正确答案AC。',
    29: '邓小平在南方视察期间发表了著名的\u201c南方谈话\u201d，其中包括\u201c革命是解放生产力，改革也是解放生产力\u201d、\u201c计划多一点还是市场多一点，不是社会主义与资本主义的本质区别\u201d、必须始终注意坚持四项基本原则。B选项\u201c走自己的道路，建设有中国特色的社会主义\u201d是十二大上提出的，排除。正确答案ACD。',
    30: '法律至上具体表现为法律的普遍适用性、优先适用性和不可违抗性。A项体现不可违抗性，C项体现普遍适用性，D项体现优先适用性。B项\u201c按照法律的逻辑来分析和解决一切社会问题\u201d中\u201c一切社会问题\u201d表述错误。故正确答案ACD。',
    31: '集体主义强调国家利益、社会整体利益和个人利益的辩证统一。国家利益、社会整体利益高于个人利益（B正确）。但要求个人作出牺牲并不是任意的，A项\u201c无条件服从\u201d错误。集体利益不是个人所有利益的总和，C项错误。集体主义重视和保障个人的正当利益（D正确）。正确答案BD。',
    32: '为依法惩治\u201c台独\u201d顽固分子分裂国家、煽动分裂国家犯罪，切实维护国家主权、统一和领土完整，该《意见》明确了犯罪性质和惩处程序，回应了民众诉求，彰显了捍卫主权的立场，充实了反\u201c台独\u201d法律工具箱。ABCD四个选项都是符合题意的。',
    33: '金砖合作机制坚持开放包容、坚持合作共赢、坚持公平正义，从而推动金砖机制持续壮大。ABC是符合题意的。D项\u201c以构建同盟为路径\u201d违背了我国\u201c结伴不结盟\u201d的原则，排除。正确答案ABC。',
}

# 清洁后的选项文本（仅需修复的选项）
CLEAN_OPTIONS = {
    1: {3: '逆向思维'},
    2: {0: '我思故我在', 3: '历史发展的一般进程拒斥个别发展阶段的特性'},
    3: {3: '要从特定的历史条件出发对历史人物作具体全面的考察和评价'},
    4: {3: '工人阶级的革命意识与经济发展水平呈正相关性'},
    5: {3: '改变红军中残留的旧军队的不良作风'},
    6: {3: '社会主义社会矛盾学说'},
    7: {1: '实现中华优秀传统文化创造性转化、创新性发展', 3: '把握中华文明发展规律'},
    8: {3: '制度型开放'},
    9: {3: '建设更高水平的平安中国'},
    10: {3: '中国在政治经济上完全成为西方的附庸'},
    11: {3: '农民日益贫困化以至大批破产'},
    12: {3: '确立了思想建党政治建军原则'},
    13: {3: '必须彻底克服教条主义和经验主义的思想'},
    14: {3: '通信自由权'},
    15: {3: '教育、科技、人才'},
    16: {3: '在非洲打造全球安全倡议\u201c合作示范区\u201d'},
    17: {3: '人的活动的选择性与自然界的先在性是动态统一的'},
    18: {3: '能够物化为机器的物理运动从而延伸意识器官的功能'},
    19: {3: '随着客体属性的自然显露而转化为社会价值'},
    20: {3: '封建社会时期由佃农生产并上缴给地主的地租'},
    21: {3: '资产阶级不对生产工具和生产关系进行革命，就不能生存'},
    22: {3: '都以独创性的理论成果丰富和发展了马克思主义'},
    23: {3: '非公有制经济发展活力不断提升'},
    24: {3: '丰富中国特色社会主义民主形式'},
    25: {3: '科学推进水土流失综合治理'},
    26: {3: '文化繁荣有助于促进社会创新创造的活力动力'},
    27: {3: '是区别于第二国际旧式社会改良党的新型工人阶级革命政党'},
    28: {3: '会议指明了党内小资产阶级思想的来源、表现及纠正方法'},
    29: {3: '\u201c在整个改革开放的过程中，必须始终注意坚持四项基本原则\u201d'},
    30: {3: '当同一项社会关系同时受到多种社会规范的调整而多种社会规范又相互矛盾时，要优先考虑法律规范的适用'},
    31: {3: '重视和保障个人的正当利益'},
    32: {3: '充实了反\u201c台独\u201d、反干涉的法律工具箱'},
    33: {3: '以构建同盟为路径'},
}

# 需要删除多余选项的卡片（删除第5个选项，即index=4）
REMOVE_EXTRA_OPTION = {2, 4, 14, 16, 21, 31}

# OCR 伪影正则
OCR_ARTIFACT_RE = re.compile(
    r'[•=口\s]*\d{0,2}2025\u5e74(\u8003\u7814|\u5168\u56fd\u7855[\u571f\u58eb]\u7814\u7a76\u751f\u62db\u751f\u8003\u8bd5)\uff08\u653f\u6cbb\uff09\u53c2\u8003\u7b54\u6848'
)

# 二、三节标题
SECTION_HEADER_RE = re.compile(
    r'[\u4e8c\u4e09]\u3001(\u591a\u9879\u9009\u62e9\u9898|\u5206\u6790\u9898)\uff1a\u5171\d+\u9898.*$'
)


def clean_text(text):
    text = OCR_ARTIFACT_RE.sub('', text)
    text = SECTION_HEADER_RE.sub('', text)
    text = text.strip()
    return text


def main():
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    cards = data['cards']
    fixed_cards = []

    i = 0
    while i < len(cards):
        card = copy.deepcopy(cards[i])
        num = card['number']

        if card['type'] == 'choice' and num in ANSWERS:
            # 1. 设置答案
            card['answer'] = ANSWERS[num]

            # 2. 设置题型
            if num <= 16:
                card['type'] = 'single_choice'
            else:
                card['type'] = 'multi_choice'

            # 3. 清洁选项文本
            if num in CLEAN_OPTIONS:
                for opt_idx, clean_text_val in CLEAN_OPTIONS[num].items():
                    if opt_idx < len(card['options']):
                        card['options'][opt_idx]['text'] = clean_text_val

            # 4. 删除多余选项
            if num in REMOVE_EXTRA_OPTION and len(card['options']) > 4:
                card['options'] = card['options'][:4]

            # 5. 确保标签为 A B C D
            labels = ['A', 'B', 'C', 'D']
            for j in range(min(4, len(card['options']))):
                card['options'][j]['label'] = labels[j]

            # 6. 设置正确的解析
            card['explanation'] = EXPLANATIONS[num]

            # 7. 清洁题目文本
            card['question'] = clean_text(card['question'])

            fixed_cards.append(card)
            i += 1

        elif card['type'] == 'analysis':
            if (i + 1 < len(cards)
                    and cards[i + 1]['number'] == num
                    and cards[i + 1]['type'] == 'analysis'):
                answer_card = cards[i + 1]
                answer_text = answer_card['question']
                answer_text = re.sub(r'^\u3010\u53c2\u8003\u7b54\u6848\u3011\s*', '', answer_text)
                card['question'] = clean_text(card['question'])
                answer_text = clean_text(answer_text)
                answer_text = re.sub(r'\s*\d{1,2}\s*$', '', answer_text)
                card['answer'] = answer_text
                card['explanation'] = ''
                card['type'] = 'analysis'
                fixed_cards.append(card)
                i += 2
            else:
                card['question'] = clean_text(card['question'])
                card['type'] = 'analysis'
                fixed_cards.append(card)
                i += 1
        else:
            card['question'] = clean_text(card['question'])
            fixed_cards.append(card)
            i += 1

    data['cards'] = fixed_cards
    data['total_cards'] = len(fixed_cards)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'done')
    print(f'original: {len(cards)} cards')
    print(f'fixed: {len(fixed_cards)} cards')

    single_count = sum(1 for c in fixed_cards if c['type'] == 'single_choice')
    multi_count = sum(1 for c in fixed_cards if c['type'] == 'multi_choice')
    analysis_count = sum(1 for c in fixed_cards if c['type'] == 'analysis')

    print(f'  single_choice: {single_count}')
    print(f'  multi_choice: {multi_count}')
    print(f'  analysis: {analysis_count}')

    empty_answers = [c['id'] for c in fixed_cards if not c['answer']]
    if empty_answers:
        print(f'WARNING: empty answers: {empty_answers}')
    else:
        print('OK: all answer fields filled')

    wrong_opts = [
        c['id'] for c in fixed_cards
        if c['type'] in ('single_choice', 'multi_choice') and len(c['options']) != 4
    ]
    if wrong_opts:
        print(f'WARNING: wrong option count: {wrong_opts}')
    else:
        print('OK: all choice cards have 4 options')


if __name__ == '__main__':
    main()
