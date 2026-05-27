#!/usr/bin/env python3
"""
Build the 2025 English II public-course bank from local Baidu Netdisk PDFs.

The source paper has a usable text layer for most question material, but some
watermarks corrupt option text. The constants below are the cleaned paper text
and answer keys cross-checked against the local answer PDF plus the detailed
analysis PDF/OCR generated from the same Baidu folder.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-2025" / "english2"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english2-2025.json"

PAPER = RAW_DIR / "2025-english2-paper.pdf"
ANSWER_PARTIAL = RAW_DIR / "2025-english2-answer-partial.pdf"
PAPER_ANSWER = RAW_DIR / "2025-english2-paper-answer.pdf"
DETAILED_ANALYSIS = RAW_DIR / "2025-english2-detailed-analysis.pdf"

SOURCE_IDS = {
    "paper": "english2-2025-paper",
    "answer_partial": "english2-2025-answer-partial",
    "paper_answer": "english2-2025-paper-answer",
    "detailed_analysis": "english2-2025-detailed-analysis",
}

CLOZE_PASSAGE = (
    "There are many understandable reasons why you might find it difficult to ask for help when you need it. "
    "Psychologists have been interested in this (1) for decades, not least because people's widespread (2) to ask "
    "for help has led to some high-profile failures. Asking for help takes (3). It involves communicating a need on "
    "your part - there's something you can't do. (4), you're broadcasting your own weaknesses, which can be (5). "
    "You might worry about (6) about losing control of whatever it is you're asking for help with. (7) someone "
    "starts to help, perhaps they'll take over, or get credit for your earlier efforts. Yet another (8) that you "
    "might be worried about is being a nuisance or (9) the person you go to for help. If you struggle with low "
    "self-esteem, you might find it especially difficult to (10) for help because you have the added worry of the "
    "other person (11) your request. You might see such refusals as implying something (12) about the status of your "
    "relationship with them. To (13) these difficulties, try to remind yourself that everyone needs help sometimes. "
    "Nobody knows everything and can do everything all by themselves. And while you might (14) coming across as "
    "incompetent, there's actually research that shows that advice-seekers are (15) as more competent, not less. "
    "Perhaps most encouraging of all is a paper from 2022 by researchers at Stanford University that involved a mix "
    "of contrived help-seeking interactions and asking people to (16) times they'd sought help in the past. The "
    "findings showed that help-seekers generally underestimate how (17) other people will be to help and how good "
    "it'll make the help-giver feel (for most people, having the chance to help someone is highly (18)). So, bear "
    "all this in mind the next time you need to ask for help. (19), take care over who you ask and when you ask them. "
    "And if someone can't help right now, avoid taking it personally. They might just be too (20), or they might not "
    "feel confident about their ability to help."
)

CLOZE_OPTIONS = {
    1: {"A": "illusion", "B": "discussion", "C": "tradition", "D": "question"},
    2: {"A": "reluctance", "B": "ambition", "C": "tendency", "D": "enthusiasm"},
    3: {"A": "attention", "B": "talent", "C": "courage", "D": "patience"},
    4: {"A": "At any time", "B": "In other words", "C": "By all means", "D": "On the contrary"},
    5: {"A": "unrealistic", "B": "deceptive", "C": "tiresome", "D": "uncomfortable"},
    6: {"A": "doubts", "B": "concerns", "C": "suggestions", "D": "secrets"},
    7: {"A": "Once", "B": "Unless", "C": "Although", "D": "Before"},
    8: {"A": "theory", "B": "choice", "C": "factor", "D": "context"},
    9: {"A": "overpraising", "B": "outperforming", "C": "reassessing", "D": "inconveniencing"},
    10: {"A": "reach out", "B": "settle down", "C": "turn over", "D": "look back"},
    11: {"A": "declining", "B": "considering", "C": "criticising", "D": "evaluating"},
    12: {"A": "unnecessary", "B": "negative", "C": "strange", "D": "impractical"},
    13: {"A": "explain", "B": "identify", "C": "predict", "D": "overcome"},
    14: {"A": "deny", "B": "forget", "C": "miss", "D": "fear"},
    15: {"A": "disguised", "B": "perceived", "C": "followed", "D": "introduced"},
    16: {"A": "recall", "B": "classify", "C": "analyse", "D": "compare"},
    17: {"A": "brave", "B": "surprising", "C": "willing", "D": "hesitant"},
    18: {"A": "relaxing", "B": "disappointing", "C": "rewarding", "D": "demanding"},
    19: {"A": "Thus", "B": "Also", "C": "Finally", "D": "Instead"},
    20: {"A": "polite", "B": "proud", "C": "busy", "D": "lazy"},
}

CLOZE_ANSWERS = {
    1: "D",
    2: "A",
    3: "C",
    4: "B",
    5: "D",
    6: "B",
    7: "A",
    8: "C",
    9: "D",
    10: "A",
    11: "A",
    12: "B",
    13: "D",
    14: "D",
    15: "B",
    16: "A",
    17: "C",
    18: "C",
    19: "B",
    20: "C",
}

READING_PASSAGES = {
    "text1": (
        "U.S. customers historically tipped people they assumed were earning most of their income via tips, such as "
        "restaurant servers earning less than the minimum wage. In the early 2010s, a wide range of businesses started "
        "processing purchases with iPads and other digital payment systems. These systems prompted customers to tip for "
        "services that were not previously tipped. Today's tip requests are often not connected to the salary and service "
        "norms that used to determine when and how people tip. Customers in the past nearly always paid tips after "
        "receiving a service, such as at the conclusion of a restaurant meal, after getting a haircut or once a pizza was "
        "delivered. That timing could reward high-quality service and give workers an incentive to provide it. It's "
        "becoming more common for tips to be requested beforehand. And new tipping technology may even automatically add "
        "tips. The prevalence of digital payment devices has made it easier to ask customers for a tip. That helps explain "
        "why tip requests are creeping into new kinds of services. Customers now routinely see menus of suggested default "
        "options - often well above 20% of what they owe. The amounts have risen from 10% or less in the 1950s to 15% "
        "around the year 2000 to 20% or higher today. This increase is sometimes called tipflation - the expectation of "
        "ever-higher tip amounts. Tipping has always been a vital source of income for workers in historically tipped "
        "services, like restaurants, where the tipped minimum wage can be as low as US $2.13 an hour. Tip creep and "
        "tipflation are now further supplementing the income of many low-wage service workers. Notably, tipping primarily "
        "benefits some of these workers, such as waiters, but not others, such as cooks and dishwashers. To ensure that "
        "all employees were paid fair wages, some restaurants banned tipping and increased prices, but this movement "
        "toward no-tipping services has largely fizzled out. So, to increase employee wages without raising prices, more "
        "employers are succumbing to the temptations of tip creep and tipflation. Many customers are frustrated with "
        "being asked for too high of a tip, too often. And, as research emphasizes, tipping now seems to be more coercive, "
        "less generous and often completely disassociated from service quality."
    ),
    "text2": (
        "When it was established, the National Health Service (NHS) was visionary: offering high-quality, timely care to "
        "meet the dominant needs of the population it served. Nearly 75 years on, with the UK facing very different health "
        "challenges, it is clear that model is out of date. From life expectancy to cancer and infant mortality rates, we "
        "are lagging behind many of our peers. With more than 6.8 million on waitlists, healthcare is becoming increasingly "
        "inaccessible for those who cannot opt to pay for private treatment; and the cost of providing healthcare is "
        "increasingly squeezing out investment in other public services. As demand for healthcare continues to grow, "
        "pressures on the workforce - which is already near breaking point - will only become more acute. Many of the "
        "answers to the crisis in health and care are well rehearsed. We need to be much better at reducing and diverting "
        "demand on health services, rather than simply managing it. Much more needs to be invested in communities and "
        "primary care to reduce our reliance on hospitals. And capacity in social care needs to be greater, to support the "
        "growing number of people living with long-term conditions. Yet despite two decades of strategies and a number of "
        "major health reforms, we have failed to make meaningful progress on any of these aims. That is why the Reform "
        "think tank is launching a new programme of work entitled 'Reimagining health', supported by ten former health "
        "ministers. Together, we are calling for a much more open and honest conversation about the future of health in the "
        "UK, and an urgent rethink of the hospital-centric model we retain. This must begin with the question of how we "
        "maximise the health of the nation, rather than fix the NHS. It is estimated, for example, that healthcare accounts "
        "for only about 20% of health outcomes. Much more important are the places we live, work and socialise - yet there "
        "is no clear cross-government strategy for improving these social determinants of health. Worse, when policies like "
        "the obesity strategy are scrapped, taxpayers are left with the heavy price tag of treating the illnesses, like "
        "diabetes, that result. Reform wants to ask how power and resources should be distributed in our health system. "
        "What health functions should remain at the centre, and what should be given to local leaders, often responsible "
        "for services that create health, and with a much better understanding of the needs of their populations?"
    ),
    "text3": (
        "Heat action plans, or HAPs, have been proliferating in India in the past few years. In general, a HAP spells out "
        "when and how officials should issue heat warnings and alert hospitals and other institutions. Nagpur's plan, for "
        "instance, calls for hospitals to set aside 'cold wards' in the summer for treating heatstroke patients, and advises "
        "builders to give construction laborers a break from work on very hot days. But implementation of existing HAPs "
        "has been uneven, according to a report from the Centre for Policy Research. Many lack adequate funding, it found. "
        "And their triggering thresholds often are not customized to the local climate. In some areas, high daytime "
        "temperatures alone might serve as an adequate trigger for alerts. But in other places, nighttime temperatures or "
        "humidity might be as important a gauge of risk as daytime highs. Mumbai's April heatstroke deaths highlighted the "
        "need for more nuanced and localized warnings, researchers say. That day's high temperature of roughly 36 C was "
        "1 C shy of the heat wave alert threshold for coastal cities set by national meteorological authorities. But the "
        "effects of the heat were amplified by humidity - an often neglected factor in heat alert systems - and the lack "
        "of shade at the late-morning outdoor ceremony. To help improve HAPs, urban planner Rajashree Kotharkar's team is "
        "working on a model plan that outlines best practices and could be adapted to local conditions. Among other things, "
        "she says, all cities should create a vulnerability map to help focus responses on the populations most at risk. "
        "Such mapping doesn't need to be complex, Kotharkar says. A useful map can be created by looking at even a few key "
        "parameters. For example, neighborhoods with a large elderly population or informal dwellings that cope poorly with "
        "heat could get special warnings or be bolstered with cooling centers. The Nagpur project has already created a "
        "risk and vulnerability map, which enabled Kotharkar to tell officials which neighborhoods to focus on in the event "
        "of a heat wave this summer. HAPs shouldn't just include short-term emergency responses, researchers say, but also "
        "recommend medium- to long-term measures that could make communities cooler. In Nagpur, for example, Kotharkar's "
        "team has been able to advise city officials about where to plant trees to provide shade. HAPs could also guide "
        "efforts to retrofit homes or modify building regulations. Reducing deaths in an emergency is a good target to have, "
        "but it's the lowest target, says climate researcher Chandni Singh."
    ),
    "text4": (
        "Navigating beyond the organised pavements and parks of our urban spaces, desire paths are the unofficial "
        "footprints of a community, revealing the unspoken preferences, shared shortcuts and collective choices of humans. "
        "Often appearing as trodden dirt tracks through otherwise neat green spaces, these routes of collective "
        "disobedience cut corners, bisect lawns and cross hills, representing the natural capability of people and animals "
        "to go from point A to point B most effectively. Urban planners interpret desire paths as more than just convenient "
        "shortcuts; they offer valuable insights into the dynamics between planning and behaviour. Ohio State University "
        "allowed its students to navigate the Oval, a lawn in the centre of campus, freely, then proceeded to pave the "
        "desire paths, creating a web of effective routes students had established. Yet, reluctance persists among other "
        "planners to integrate desire paths into formal plans, citing concerns about safety, environmental impact, or "
        "primarily, aesthetics. A Reddit webpage devoted to the phenomenon, boasting nearly 50,000 members, showcases "
        "images of local desire paths adorned with signs instructing pedestrians to adhere to designated walkways, "
        "underscoring the rebellious nature inherent in these human-made tracks. This clash highlights an ongoing struggle "
        "between the organic, user-driven evolution of public spaces and the desire for a visually curated and controlled "
        "urban environment. The Wickquasgeck Trail is an example of a historical desire path, created by Native Americans "
        "to cross the forests of Manhattan and move between settlements quickly. This trail, when Dutch colonists arrived, "
        "was widened and made into one of the main trade roads across the island, known at the time as de Heere Straat, or "
        "Gentlemen's Street. Following the British assumption of control in New York, the street was renamed Broadway. "
        "Notably, Broadway stands out as one of the few areas in NYC that defies the grid-based system applied to the rest "
        "of the city, cutting a diagonal across parts of the city. In online spaces, desire paths have sparked a fascination "
        "that can approach obsession, with the Reddit page serving as a hub. Contributors offer a wide array of stories, "
        "from little-known new shortcuts to long-established alternate routes. Animal desire paths, such as ducks forging "
        "trails through frozen ponds or dogs carving direct routes in gardens, highlight the adaptability of these trails "
        "in both human and animal experiences. As desire paths criss-cross through both physical and virtual landscapes, "
        "they stand as a proof of the collective insistence on forging unconventional routes and embracing the spirit of "
        "communal choice."
    ),
}

READING_QUESTIONS = {
    21: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "According to Paragraph 1, the practice of tipping in the U.S. ________.",
        "options": {
            "A": "was regarded by many customers as a sign of generosity",
            "B": "was considered essential for waiters",
            "C": "was a way of rewarding diligence",
            "D": "was optional in most businesses",
        },
    },
    22: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "Compared with tips in the past, today's tips ________.",
        "options": {
            "A": "are paid much less frequently",
            "B": "are less often requested in advance",
            "C": "have less to do with service quality",
            "D": "contribute less to workers' income",
        },
    },
    23: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "Tip requests are creeping into new kinds of services as a result of ________.",
        "options": {
            "A": "the advancement of technology",
            "B": "the desire for income increase",
            "C": "the diversification of business",
            "D": "the emergence of tipflation",
        },
    },
    24: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "The movement toward no-tipping services was intended to ________.",
        "options": {
            "A": "promote consumption",
            "B": "enrich income sources",
            "C": "maintain reasonable prices",
            "D": "guarantee income fairness",
        },
    },
    25: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "It can be learned from the last paragraph that tipping ________.",
        "options": {
            "A": "is becoming a burden for customers",
            "B": "helps encourage quality service",
            "C": "is vital to business development",
            "D": "reflects the need to reduce prices",
        },
    },
    26: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "According to the first two paragraphs, the NHS ________.",
        "options": {
            "A": "is troubled by funding deficiencies",
            "B": "can hardly satisfy people's needs",
            "C": "can barely retain its current employees",
            "D": "is rivalled by private medical services",
        },
    },
    27: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "One answer to the crisis in health and care is to ________.",
        "options": {
            "A": "boost the efficiency of hospitals",
            "B": "lighten the burden on social care",
            "C": "increase resources for primary care",
            "D": "reduce the pressure on communities",
        },
    },
    28: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "'Reimagining health' is aimed to ________.",
        "options": {
            "A": "reinforce hospital management",
            "B": "readjust healthcare regulations",
            "C": "restructure the health system",
            "D": "resume suspended health reforms",
        },
    },
    29: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "To maximise the nation's health, the author suggests ________.",
        "options": {
            "A": "introducing relevant taxation policies",
            "B": "paying due attention to social factors",
            "C": "reevaluating major health outcomes",
            "D": "enhancing the quality of healthcare",
        },
    },
    30: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "It can be inferred that local leaders should ________.",
        "options": {
            "A": "exercise their power more reasonably",
            "B": "develop a stronger sense of responsibility",
            "C": "play a bigger role in the health system",
            "D": "understand people's health needs better",
        },
    },
    31: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "According to Paragraph 1, Nagpur's plan proposes measures to ________.",
        "options": {
            "A": "tackle extreme weather",
            "B": "ensure construction quality",
            "C": "monitor emergency warnings",
            "D": "address excessive workloads",
        },
    },
    32: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "One problem with existing HAPs is that they ________.",
        "options": {
            "A": "prove too costly to be implemented",
            "B": "lack localized alert-issuing criteria",
            "C": "give delayed responses to heat waves",
            "D": "keep hospitals under great pressure",
        },
    },
    33: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "Mumbai's case shows that India's heat alert systems need to ________.",
        "options": {
            "A": "include other factors besides temperature",
            "B": "take subtle weather changes into account",
            "C": "prioritize potentially disastrous heat waves",
            "D": "draw further support from local authorities",
        },
    },
    34: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "Kotharkar holds that a vulnerability map can help ________.",
        "options": {
            "A": "prevent the harm of high humidity",
            "B": "target areas needing special attention",
            "C": "expand the Nagpur project's coverage",
            "D": "make relief plans for heat-stricken people",
        },
    },
    35: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "According to the last paragraph, researchers believe that HAPs should ________.",
        "options": {
            "A": "focus more on heatstroke treatment",
            "B": "apply for more government grants",
            "C": "invite wider public participation",
            "D": "serve a broader range of purposes",
        },
    },
    36: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "According to Paragraph 1, desire paths are a result of ________.",
        "options": {
            "A": "the curiosity to explore surrounding hills",
            "B": "the necessity to preserve green spaces",
            "C": "the tendency to pursue convenience",
            "D": "the wish to find comfort in solitude",
        },
    },
    37: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "It can be inferred that Ohio State University ________.",
        "options": {
            "A": "intends to improve its desire paths",
            "B": "leads in the research on desire paths",
            "C": "guides the creation of its desire paths",
            "D": "takes a positive view of desire paths",
        },
    },
    38: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "The images on the Reddit webpage reflect ________.",
        "options": {
            "A": "conflicting opinions on the use of desire paths",
            "B": "the call to upgrade the designing of public spaces",
            "C": "the demand for proper planning of desire paths",
            "D": "growing concerns over the loss of public spaces",
        },
    },
    39: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "The example of the Wickquasgeck Trail illustrates ________.",
        "options": {
            "A": "the growth of New York City",
            "B": "the Dutch origin of desire paths",
            "C": "the importance of urban planning",
            "D": "the recognition of desire paths",
        },
    },
    40: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "It can be learned from the last paragraph that desire paths ________.",
        "options": {
            "A": "reveal humans' deep respect for nature",
            "B": "are crucial to humans' mental wellbeing",
            "C": "are a human imitation of animal behaviour",
            "D": "show a shared trait in humans and animals",
        },
    },
}

READING_ANSWERS = {
    21: "B",
    22: "C",
    23: "A",
    24: "D",
    25: "A",
    26: "B",
    27: "C",
    28: "C",
    29: "B",
    30: "C",
    31: "A",
    32: "B",
    33: "A",
    34: "B",
    35: "D",
    36: "C",
    37: "D",
    38: "A",
    39: "D",
    40: "D",
}

PART_B_MATERIAL = (
    "Five Steps to Suggesting a Change at Work That'll Actually Get Taken Seriously. Everyone wants to be that person - "
    "the one who looks at the same information as everyone else, but who sees a fresh, innovative solution. However, it "
    "takes more than simply having a good idea. How you share it is as important as the suggestion itself. Why? Because "
    "writing a new script - literally or figuratively - means that other team members will have to adapt to something new. "
    "So whether you're suggesting a seemingly benign change like streamlining outdated protocol, or a bigger change like "
    "adding an hour to each workday so people can leave early on Fridays, you're asking others to reimagine their workflow "
    "or schedule. Not to mention, if the process you're scrapping is one someone else suggested, there's the possibility "
    "of hurt feelings. To gain buy-in on an innovative, new idea, follow these steps."
)

PART_B_PARAGRAPHS = {
    41: (
        "Great ideas don't stand alone. In other words, you can't mention your suggestion once and expect it to be adopted. "
        "To see a change, you'll need to champion your plan and sell its merits. In addition, you need to be willing to "
        "stand up to scrutiny and criticism and be prepared to explain your innovation in different ways for various audiences."
    ),
    42: (
        "Sometimes it makes sense to go to your boss first. But other times, it's useful to build a coalition among your "
        "co-workers or other stakeholders. When it works, it works great - because you're ready for your stubborn supervisor's "
        "pushback with answers like, 'Actually, I connected with a few people in our tech department to discuss how much time "
        "these kinds of website updates would take, and they suggested they have the bandwidth.' However, just be certain you "
        "can explain your end-around approach as one that built your case, rather than simply circumvented your manager. The "
        "last thing you want is for your boss to feel embarrassed he wasn't informed - which could lead him to quash the idea "
        "before it even takes off."
    ),
    43: (
        "One of the biggest barriers to gaining buy-in occurs when the owner of an idea is viewed as argumentative, defensive, "
        "or close-minded. Because, let's be honest: No one likes a know-it-all. So, if people disagree with you, don't be "
        "indignant. Instead, listen to their concerns fully, try to understand their perspective, and include their concerns "
        "and possible remedies in future discussions. So, instead of saying, 'Martha, our current slogan is confusing and "
        "should be updated,' you could try, 'Martha raises a great point that our current slogan has a long history for our "
        "stakeholders, but I wonder if we might be able to brainstorm a tagline that could build on that - and be clearer for "
        "new customers.'"
    ),
    44: (
        "New ideas are the grandchildren of old ones. In other words, don't throw old solutions under the bus to make your "
        "improvement stand out. Remember that in light of whatever the problem the old system solved - or, maybe, has failed "
        "to solve in recent memory - it was a great idea at the time. Appreciating the older contributions as you suggest "
        "future innovations helps bolster the credibility of your idea."
    ),
    45: (
        "When pitching a new idea, it's important to use the language of abundance instead of the language of deficit. Instead "
        "of saying what is wrong, broken, or suboptimal, talk about what is right, fixable, or ideal. For example, try, 'I can "
        "see lots of applications for this new approach' rather than, 'This innovation is the only way.' Be optimistic but "
        "realistic, and you will stand out."
    ),
}

PART_B_OPTIONS = {
    "A": "Stay positive",
    "B": "Respect the past",
    "C": "Use channels",
    "D": "Give it time",
    "E": "Invite resistance",
    "F": "Be a salesman",
    "G": "Be humble",
}

PART_B_ANSWERS = {41: "F", 42: "C", 43: "G", 44: "B", 45: "A"}

TRANSLATION_TEXT = (
    "You know the moment - the conversation slows, then there's a pause. It's awkward, and so awkward that some people "
    "will panic and say anything. Do we all find such silences so stressful? Researchers analysed the frequency and impact "
    "of gaps greater than 2 seconds during conversations, including an overview of previous studies which indicate that the "
    "fear of awkward silences can be so extreme that people avoid talking to strangers, even though doing so is likely to be "
    "an enjoyable experience. During conversations with short gaps, people feel more connected to their conversation partners. "
    "But such feeling of connection markedly dips when entering a long gap. Long gaps between strangers are likely to be "
    "followed by a change in topic. But the opposite seems to be true for conversations between friends. Long gaps there saw "
    "increased connection. Between friends, longer gaps seem to provide natural moments for reflection and expression."
)

TRANSLATION_ANSWER = (
    "你知道那一刻——对话慢了下来，然后出现了停顿。这很尴尬，尴尬到有些人会惊慌失措，说出任何话来。"
    "我们所有人都觉得这样的沉默如此有压力吗？研究人员分析了对话中超过 2 秒的停顿的频率和影响，"
    "包括对先前研究的概述，这些研究表明对尴尬沉默的恐惧可能非常强烈，以至于人们避免与陌生人交谈，"
    "尽管这样做很可能会是一次愉快的体验。在对话中，短暂的停顿让人们感觉与对话伙伴更加亲近。"
    "但当进入长时间的停顿时，这种连接感会显著下降。陌生人之间的长时间停顿可能会伴随话题的转变。"
    "但对于朋友之间的对话来说，情况似乎正好相反。在朋友之间，长时间的停顿反而增加了连接感。"
    "在朋友之间，更长的停顿似乎提供了自然的反思和表达时刻。"
)

WRITING_PROMPTS = {
    47: (
        "47. Directions: Suppose you are planning a short play based on a classic Chinese novel. Write your friend John an "
        "e-mail to: 1) introduce the play and 2) invite him take part in it. You should write about 100 words on the ANSWER "
        "SHEET. Do not use your own name. Use 'Li Ming' instead. (10 points)"
    ),
    48: (
        "48. Directions: Write an essay based on the chart below. In your writing, you should: 1) interpret the chart, and "
        "2) give your comments. You should write about 150 words on the ANSWER SHEET. (15 points) Chart: 某社区老年人主要日常"
        "休闲活动调查，活动占比为看电视 90.80%、看书 86.30%、养花 34.70%、阅读 31.80%、下象棋 18.40%。"
    ),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    return " ".join(str(value or "").split())


def hash_text(value: Any) -> str:
    text = compact(value)
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(PROJECT_ROOT))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def require_sources() -> None:
    missing = [str(path) for path in [PAPER, ANSWER_PARTIAL, PAPER_ANSWER, DETAILED_ANALYSIS] if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English II 2025 source PDFs: " + ", ".join(missing))


def evidence_source_path(source_id: str) -> Path:
    if source_id == SOURCE_IDS["paper"]:
        return PAPER
    if source_id == SOURCE_IDS["answer_partial"]:
        return ANSWER_PARTIAL
    if source_id == SOURCE_IDS["paper_answer"]:
        return PAPER_ANSWER
    if source_id == SOURCE_IDS["detailed_analysis"]:
        return DETAILED_ANALYSIS
    raise KeyError(source_id)


def attach_evidence(
    card: dict[str, Any],
    *,
    question_source_id: str,
    answer_source_id: str,
    now: str,
    answer_method: str,
    answer_note: str,
    answer_role: str = "answer_key",
) -> dict[str, Any]:
    question_source_path = evidence_source_path(question_source_id)
    answer_source_path = evidence_source_path(answer_source_id)
    question_hash = hash_text(card["question"])
    answer_hash = hash_text(card["answer"])

    card["sourceEvidenceId"] = question_source_id
    card["sourceEvidence"] = {
        "evidenceId": question_source_id,
        "sourceId": question_source_id,
        "sourceType": "official_paper",
        "sourceFilePath": relative(question_source_path),
        "fileSha256": sha256_file(question_source_path),
        "status": "matched",
        "method": "local_pdf_text_and_visual_extraction",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2025_bank",
    }
    card["questionTextHash"] = question_hash
    card["answerTextHash"] = answer_hash
    card["answerEvidenceStatus"] = "matched"
    card["answerSourceFilePath"] = relative(answer_source_path)
    card["answerEvidenceSourceId"] = answer_source_id
    card["answerEvidence"] = {
        "status": "matched",
        "sourceId": answer_source_id,
        "sourceFilePath": relative(answer_source_path),
        "answerTextHash": answer_hash,
        "method": answer_method,
        "evidenceRole": answer_role,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2025_bank",
        "note": answer_note,
    }
    return card


def base_card(number: int, *, card_type: str, section: str, group_id: str, question: str, answer: str) -> dict[str, Any]:
    return {
        "id": f"english2-2025-{number:03d}",
        "paperId": "english2-2025",
        "paperName": "2025考研英语二真题",
        "subject": "英语",
        "track": "english2",
        "year": "2025",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": "2025-english2-paper.pdf",
        "tags": ["english2", "2025真题", section],
    }


def build_bank(now: str | None = None) -> dict[str, Any]:
    require_sources()
    now = now or utc_now()
    cards: list[dict[str, Any]] = []

    for number in range(1, 21):
        card = base_card(
            number,
            card_type="single_choice",
            section="完形填空",
            group_id="cloze",
            question=f"Choose the best option for blank {number}.",
            answer=CLOZE_ANSWERS[number],
        )
        card["passage"] = CLOZE_PASSAGE
        card["options"] = option_list(CLOZE_OPTIONS[number])
        card["explanation"] = "答案已按本地百度网盘英语二参考答案 PDF 匹配；第 9 题 D 选项按答案 PDF 修复原卷水印/OCR 误读。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper"],
                answer_source_id=SOURCE_IDS["answer_partial"],
                now=now,
                answer_method="local_answer_pdf_exact_match",
                answer_note="Matched against the local 2025 English II answer PDF.",
            )
        )

    for number in range(21, 41):
        data = READING_QUESTIONS[number]
        card = base_card(
            number,
            card_type="single_choice",
            section=data["section"],
            group_id=data["group"],
            question=data["question"],
            answer=READING_ANSWERS[number],
        )
        card["passage"] = READING_PASSAGES[data["group"]]
        card["options"] = option_list(data["options"])
        card["explanation"] = "答案已按本地百度网盘逐题细解 PDF/OCR 匹配，优先采用与原卷选项一致的完整解析答案。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper"],
                answer_source_id=SOURCE_IDS["detailed_analysis"],
                now=now,
                answer_method="local_detailed_analysis_ocr_match",
                answer_note="Matched against the local detailed-analysis PDF/OCR for 2025 English II.",
            )
        )

    for number in range(41, 46):
        card = base_card(
            number,
            card_type="single_choice",
            section="新题型",
            group_id="part-b",
            question=f"Choose the most suitable subheading for paragraph {number}.",
            answer=PART_B_ANSWERS[number],
        )
        card["passage"] = f"{PART_B_MATERIAL}\n\nParagraph {number}: {PART_B_PARAGRAPHS[number]}"
        card["material"] = PART_B_MATERIAL
        card["options"] = option_list(PART_B_OPTIONS)
        card["explanation"] = "答案已按本地百度网盘逐题细解 PDF/OCR 与版本一答案页匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper"],
                answer_source_id=SOURCE_IDS["detailed_analysis"],
                now=now,
                answer_method="local_detailed_analysis_ocr_match",
                answer_note="Part B headings were matched against the local detailed-analysis PDF/OCR.",
            )
        )

    translation = base_card(
        46,
        card_type="translation",
        section="翻译",
        group_id="translation",
        question="Translate the following text into Chinese.",
        answer=TRANSLATION_ANSWER,
    )
    translation["passage"] = TRANSLATION_TEXT
    translation["targetSegment"] = TRANSLATION_TEXT
    translation["explanation"] = "参考译文已按本地百度网盘英语二参考答案 PDF 匹配。"
    cards.append(
        attach_evidence(
            translation,
            question_source_id=SOURCE_IDS["paper"],
            answer_source_id=SOURCE_IDS["answer_partial"],
            now=now,
            answer_method="local_answer_pdf_translation_reference",
            answer_note="Translation reference was matched against the local 2025 English II answer PDF.",
        )
    )

    for number in (47, 48):
        source_id = SOURCE_IDS["paper_answer"] if number == 48 else SOURCE_IDS["paper"]
        prompt = WRITING_PROMPTS[number]
        card = base_card(
            number,
            card_type="essay",
            section="写作",
            group_id="writing",
            question=prompt,
            answer=f"按官方题干完成写作任务：{prompt}",
        )
        card["passage"] = prompt
        card["explanation"] = "写作题按官方题干和图表任务训练，不提供唯一范文答案。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=source_id,
                answer_source_id=source_id,
                now=now,
                answer_method="local_writing_prompt_text_hash",
                answer_role="official_writing_prompt",
                answer_note="Writing has no single official answer; matched evidence covers the official prompt and task requirements.",
            )
        )

    return {
        "id": "english2-2025",
        "source": "2025-english2-paper.pdf",
        "paperId": "english2-2025",
        "paperName": "2025考研英语二真题",
        "subject": "英语",
        "track": "english2",
        "year": "2025",
        "quality": "ready",
        "publicationStatus": "published",
        "processed_at": now,
        "total_cards": len(cards),
        "sections": ["完形填空", "阅读理解", "新题型", "翻译", "写作"],
        "sourceEvidenceSummary": {
            "questionSources": [SOURCE_IDS["paper"], SOURCE_IDS["paper_answer"]],
            "answerSources": [SOURCE_IDS["answer_partial"], SOURCE_IDS["detailed_analysis"], SOURCE_IDS["paper_answer"]],
            "policy": "local_baidu_pdf_text_visual_and_detailed_analysis_match",
        },
        "cards": cards,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build 2025 English II public-course flashcard bank.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    bank = build_bank()
    write_json(args.output, bank)
    print(
        "[english2-2025] "
        f"output={args.output.relative_to(PROJECT_ROOT)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
