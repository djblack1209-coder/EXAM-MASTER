import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildReleaseBlockerBacklog,
  renderBacklogMarkdown,
  run
} from '../../scripts/build/release-blocker-backlog.mjs';

describe('release blocker backlog', () => {
  it('can skip markdown output for temporary read-only audits', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-release-backlog-'));
    const questionAuditPath = path.join(tempDir, 'question-bank-release-audit.json');
    const flashcardQualityPath = path.join(tempDir, 'flashcard-quality-report.json');
    const externalAuditPath = path.join(tempDir, 'release-external-audit.json');
    const wechatSmokePath = path.join(tempDir, 'wechat-devtools-release-smoke.json');
    const outputPath = path.join(tempDir, 'release-blocker-backlog.json');
    const markdownPath = path.join(tempDir, 'release-blocker-backlog.md');

    try {
      fs.writeFileSync(
        questionAuditPath,
        JSON.stringify({ releaseReadiness: { canPublish: true }, summary: {}, coverage: { tracks: [] } })
      );
      fs.writeFileSync(
        flashcardQualityPath,
        JSON.stringify({ releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] })
      );
      fs.writeFileSync(
        externalAuditPath,
        JSON.stringify({ releaseReadiness: { canPublish: true }, summary: {}, sections: {} })
      );
      fs.writeFileSync(wechatSmokePath, JSON.stringify({ status: 'passed' }));

      const exitCode = await run([
        '--question-audit',
        questionAuditPath,
        '--flashcard-quality',
        flashcardQualityPath,
        '--external-audit',
        externalAuditPath,
        '--wechat-smoke',
        wechatSmokePath,
        '--output',
        outputPath,
        '--markdown',
        markdownPath,
        '--no-markdown'
      ]);

      expect(exitCode).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.existsSync(markdownPath)).toBe(false);
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).verdict).toBe('passed');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('blocks explicitly when required audit inputs are missing instead of reporting empty public-course coverage', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: null,
      flashcardQuality: null,
      externalAudit: null,
      wechatSmoke: { status: 'passed' },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    expect(backlog.verdict).toBe('blocked');
    expect(backlog.summary.canPublish).toBe(false);
    expect(backlog.items.filter((item) => item.workstream === 'release_audit_inputs')).toHaveLength(3);
    expect(backlog.items[0]).toMatchObject({
      workstream: 'release_audit_inputs',
      blockerCode: 'question_bank_release_audit_missing_or_incomplete',
      filePath: 'data/question-bank-release-audit.json'
    });
    expect(backlog.workstreams.release_audit_inputs).toMatchObject({
      itemCount: 3,
      p0Count: 3
    });

    const markdown = renderBacklogMarkdown(backlog);
    expect(markdown).toContain('输入报告阻塞: 3');
    expect(markdown).toContain('## 输入报告阻塞');
    expect(markdown).toContain('先运行 npm run audit:question-bank:report');
    expect(markdown).toContain('不要把缺失输入误判为 0/0 发布状态');
  });

  it('turns gate reports into ordered, actionable release blockers without marking them passed', () => {
    const questionAudit = {
      summary: {
        requiredSlots: 2,
        publishedSlots: 0,
        pendingSlots: 1,
        pendingCoverageBlockerCount: 1,
        coverageGapCount: 1,
        sourceManifestPublishableOfficialPapers: 0,
        sourceManifestCoverageGapCount: 2,
        answerEvidenceBlockerCount: 1
      },
      releaseReadiness: { canPublish: false },
      coverage: {
        tracks: [
          {
            track: 'english1',
            requiredYears: [2025, 2026],
            publishedYears: [],
            pendingYears: [2025],
            missingYears: [2026]
          }
        ]
      },
      sourceEvidence: {
        coverage: {
          english1: {
            presentYears: [],
            missingYears: [2025, 2026],
            missingYearDiagnostics: {
              2026: {
                candidateCount: 2,
                officialPaperCandidateCount: 1,
                publishBlockedCandidateCount: 1,
                blockReasons: {
                  'status=discovered': 1,
                  'answerEvidenceStatus=missing': 2,
                  'legalReview.publishBlocked=true': 1
                },
                sampleCandidates: [
                  {
                    sourceId: 'src_eng1_2026_raw',
                    status: 'discovered',
                    sourceType: 'official_paper',
                    answerEvidenceStatus: '',
                    blockReasons: [
                      'status=discovered',
                      'answerEvidenceStatus=missing',
                      'legalReview.publishBlocked=true'
                    ],
                    remotePath: '/raw/english1/2026.pdf'
                  }
                ]
              },
              2025: {
                candidateCount: 1,
                officialPaperCandidateCount: 1,
                publishBlockedCandidateCount: 0,
                blockReasons: {
                  'answerEvidenceStatus=missing': 1,
                  'status=discovered': 1
                },
                sampleCandidates: [
                  {
                    sourceId: 'src_eng1_2025_raw',
                    status: 'discovered',
                    sourceType: 'official_paper',
                    sourceRole: 'paper',
                    answerEvidenceStatus: '',
                    blockReasons: ['status=discovered', 'answerEvidenceStatus=missing'],
                    remotePath: '/raw/english1/2025.pdf'
                  }
                ]
              }
            },
            coverageRate: 0
          }
        }
      },
      answerEvidence: {
        blockedBanks: [
          {
            bankId: 'politics-2025',
            name: '2025考研政治真题',
            track: 'politics',
            year: '2025',
            filePath: 'src/config/flashcard-banks/politics-2025.json',
            blockedCards: [
              {
                cardId: '政治-2025-001',
                missingFields: ['sourceEvidenceId', 'answerEvidenceStatus=matched']
              }
            ]
          }
        ]
      }
    };
    const flashcardQuality = {
      summary: { blockerCount: 1 },
      releaseReadiness: { canPromoteToPublic: false },
      files: [
        {
          filePath: 'data/flashcards/english1-2025.json',
          status: 'blocked',
          cardCount: 1,
          blockedCards: [{ cardId: 'english1-2025-001', missingFields: ['answerEvidenceStatus=matched'] }]
        }
      ]
    };
    const externalAudit = {
      summary: { blockerCount: 1 },
      releaseReadiness: { canPublish: false },
      sections: {
        wechatDevice: {
          status: 'blocked',
          blockers: [
            {
              code: 'wechat_device_evidence_not_passed',
              message: 'Archive WeChat evidence',
              path: 'data/release-evidence/wechat-device-smoke.md'
            }
          ]
        }
      }
    };

    const backlog = buildReleaseBlockerBacklog({
      questionAudit,
      flashcardQuality,
      externalAudit,
      wechatSmoke: { status: 'passed' },
      localSourceAudit: {
        sources: [
          {
            id: 'english1-2025-paper',
            track: 'english1',
            year: '2025',
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-paper.pdf',
            sha256: 'sha256:english1-paper',
            pageCount: 22,
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          },
          {
            id: 'english1-2025-answer',
            track: 'english1',
            year: '2025',
            role: 'answer',
            localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-answer.pdf',
            sha256: 'sha256:english1-answer',
            pageCount: 8,
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          },
          {
            id: 'english1-2026-answer',
            track: 'english1',
            year: '2026',
            role: 'answer',
            localPath: 'data/raw-inbox/public-course-2026/english1/answer.pdf',
            sha256: 'sha256:english1-2026-answer',
            pageCount: 2,
            textLayer: 'missing_or_sparse',
            quality: 'needs_ocr',
            blockers: ['no usable text layer']
          }
        ]
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    expect(backlog.verdict).toBe('blocked');
    expect(backlog.summary.canPublish).toBe(false);
    expect(backlog.summary.publicCourseBlockerItemCount).toBe(4);
    expect(backlog.summary.publicCourseBlockedSlotCount).toBe(2);
    expect(backlog.summary.publicCoursePendingCoverageBlockers).toBe(1);
    expect(backlog.summary.sourceManifestHumanRegistrationQueue).toMatchObject({
      readySlotCount: 0,
      registryDraftCount: 0,
      missingHumanFieldCount: 0,
      nextSlotKey: '',
      nextDraftCount: 0,
      nextSourceRoles: [],
      nextMissingHumanFields: [],
      nextMissingHumanFieldInstances: []
    });
    expect(backlog.sourceManifestHumanRegistrationQueue).toMatchObject({
      readySlotCount: 0,
      registryDraftCount: 0,
      missingHumanFieldCount: 0,
      nextReadySlot: null,
      slots: []
    });
    expect(backlog.publicCourseSlotBacklog).toHaveLength(2);
    expect(backlog.publicCourseSlotBacklog[0]).toMatchObject({
      slotKey: 'english1:2025',
      track: 'english1',
      year: 2025,
      blockerCode: 'pending_public_course_bank',
      slotStatus: 'pending',
      blockers: ['pending_public_course_bank', 'missing_publishable_official_source'],
      prerequisiteBlockers: ['missing_publishable_official_source'],
      sourceEvidenceStatus: 'missing_publishable_official_source',
      localSourceAuditStatus: 'present',
      localSourceAuditSummary:
        'local source audit 已有 2 个本地文件，usableTextLayer=2，needsOcr=0，blocked=0，roles: answer=1, paper=1，companions=paper+answer可读',
      sourceManifestRegistrationChecklist: {
        status: 'auto_source_evidence_candidate',
        readyForHumanVerification: false,
        verifiedSourceRegistryDrafts: [],
        blockers: []
      }
    });
    expect(backlog.publicCourseSlotBacklog[0].blockerItemIds).toEqual([
      'coverage_pending:english1:2025',
      'source_evidence_missing:english1:2025'
    ]);
    expect(backlog.publicCourseSlotBacklog[0].nextAction).toContain(
      'local source audit 已有成对可读 paper/answer 文件'
    );
    expect(backlog.publicCourseSlotBacklog[1]).toMatchObject({
      slotKey: 'english1:2026',
      blockerCode: 'missing_public_course_bank',
      slotStatus: 'missing'
    });
    expect(backlog.items.map((item) => item.workstream)).toContain('enabled_bank_evidence');
    expect(backlog.items.map((item) => item.workstream)).toContain('wechat_real_device_evidence');
    expect(backlog.items.map((item) => item.workstream)).not.toContain('wechat_devtools_smoke');
    expect(backlog.items.map((item) => item.workstream)).toContain('public_course_coverage');
    expect(backlog.items.map((item) => item.workstream)).toContain('source_manifest_evidence');
    expect(backlog.items.map((item) => item.workstream)).toContain('cleaned_flashcard_quality');
    expect(backlog.nextBalancedPublicCourseSlots[0]).toMatchObject({
      id: 'coverage_pending:english1:2025',
      track: 'english1',
      year: 2025,
      blockerCode: 'pending_public_course_bank',
      slotStatus: 'pending',
      sourceEvidenceStatus: 'missing_publishable_official_source',
      sourceCandidateSummary:
        'source manifest 已发现 1 个候选，其中 official_paper=1；当前阻断: answerEvidenceStatus=missing(1), status=discovered(1)',
      sourceCandidateSamples: [
        {
          sourceId: 'src_eng1_2025_raw',
          remotePath: '/raw/english1/2025.pdf',
          blockReasons: ['status=discovered', 'answerEvidenceStatus=missing']
        }
      ],
      localSourceAuditSummary:
        'local source audit 已有 2 个本地文件，usableTextLayer=2，needsOcr=0，blocked=0，roles: answer=1, paper=1，companions=paper+answer可读',
      localSourceAuditSamples: [
        {
          id: 'english1-2025-paper',
          localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-paper.pdf',
          sha256: 'sha256:english1-paper'
        },
        {
          id: 'english1-2025-answer',
          localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-answer.pdf',
          sha256: 'sha256:english1-answer'
        }
      ],
      sourceManifestRegistrationChecklist: {
        status: 'auto_source_evidence_candidate',
        readyForHumanVerification: false,
        verifiedSourceRegistryDrafts: [],
        blockers: []
      },
      prerequisiteBlockers: ['missing_publishable_official_source']
    });
    expect(backlog.nextBalancedPublicCourseSlots[1]).toMatchObject({
      id: 'coverage_missing:english1:2026',
      track: 'english1',
      year: 2026,
      blockerCode: 'missing_public_course_bank',
      slotStatus: 'missing',
      sourceEvidenceStatus: 'missing_publishable_official_source',
      sourceCandidateSummary:
        'source manifest 已发现 2 个候选，其中 official_paper=1；当前阻断: answerEvidenceStatus=missing(2), legalReview.publishBlocked=true(1), status=discovered(1)',
      sourceCandidateSamples: [
        {
          sourceId: 'src_eng1_2026_raw',
          remotePath: '/raw/english1/2026.pdf',
          blockReasons: ['status=discovered', 'answerEvidenceStatus=missing', 'legalReview.publishBlocked=true']
        }
      ],
      localSourceAuditSummary:
        'local source audit 已有 1 个本地文件，usableTextLayer=0，needsOcr=1，blocked=1，roles: answer=1，companions=需OCR',
      localSourceAuditSamples: [
        {
          id: 'english1-2026-answer',
          localPath: 'data/raw-inbox/public-course-2026/english1/answer.pdf',
          sha256: 'sha256:english1-2026-answer',
          blockers: ['no usable text layer']
        }
      ],
      prerequisiteBlockers: ['missing_publishable_official_source']
    });
    expect(backlog.nextBalancedPublicCourseSlots[1].nextAction).toContain('缺少可用文本层');
    expect(backlog.items.find((item) => item.id === 'coverage_missing:english1:2026')?.evidence).toMatchObject({
      sourceEvidenceStatus: 'missing_publishable_official_source',
      sourceCandidateDiagnostics: {
        candidateCount: 2,
        officialPaperCandidateCount: 1
      },
      sourceCandidateSamples: [
        {
          sourceId: 'src_eng1_2026_raw',
          status: 'discovered',
          sourceType: 'official_paper',
          sourceRole: '',
          answerEvidenceStatus: '',
          riskFlags: [],
          publishBlocked: false,
          blockReasons: ['status=discovered', 'answerEvidenceStatus=missing', 'legalReview.publishBlocked=true'],
          remotePath: '/raw/english1/2026.pdf',
          sourceUrl: ''
        }
      ]
    });
    expect(backlog.items.find((item) => item.id === 'coverage_pending:english1:2025')?.evidence).toMatchObject({
      sourceEvidenceStatus: 'missing_publishable_official_source',
      sourceCandidateSummary:
        'source manifest 已发现 1 个候选，其中 official_paper=1；当前阻断: answerEvidenceStatus=missing(1), status=discovered(1)',
      localSourceAuditStatus: 'present',
      localSourceAuditSummary:
        'local source audit 已有 2 个本地文件，usableTextLayer=2，needsOcr=0，blocked=0，roles: answer=1, paper=1，companions=paper+answer可读',
      sourceManifestRegistrationChecklist: {
        status: 'auto_source_evidence_candidate',
        readyForHumanVerification: false,
        verifiedSourceRegistryDrafts: [],
        blockers: []
      }
    });
    expect(backlog.items.find((item) => item.id === 'coverage_pending:english1:2025')?.nextAction).toContain(
      '当前可直接进入题卡清洗'
    );

    const markdown = renderBacklogMarkdown(backlog);
    expect(markdown).toContain('Source Manifest 人工注册队列');
    expect(markdown).toContain('readySlots=0，registryDrafts=0，missingHumanFields=0，next=none，nextDrafts=0');
    expect(markdown).toContain('_None._');
    expect(markdown).not.toContain('paper.sourceUrl<br>paper.verifiedBy<br>paper.evidenceNote');
    expect(markdown).not.toContain('answer.sourceUrl<br>answer.verifiedBy<br>answer.evidenceNote');
    expect(markdown).toContain('Source candidates');
    expect(markdown).toContain('Candidate sample');
    expect(markdown).toContain('Local source audit');
    expect(markdown).toContain('Local samples');
    expect(markdown).toContain('Registration checklist');
    expect(markdown).toContain('status=auto_source_evidence_candidate');
    expect(markdown).not.toContain('fill sourceUrl/verifiedBy/evidenceNote before merge');
    expect(markdown).not.toContain('commands=npm run baidu:sources:verified -> npm run baidu:sources:merge');
    expect(markdown).toContain('下一批公共课覆盖/待发布槽位');
    expect(markdown).toContain('pendingBlockers=1');
    expect(markdown).toContain('公共课阻塞槽位(去重): 2，publicCourseBlockerItems=4');
    expect(markdown.indexOf('pending_public_course_bank')).toBeLessThan(markdown.indexOf('missing_public_course_bank'));
    expect(markdown).toContain('source manifest 已发现 2 个候选');
    expect(markdown).toContain(
      'src_eng1_2025_raw (discovered/official_paper, role=paper, answerEvidenceStatus=missing, blockers=status=discovered;answerEvidenceStatus=missing): /raw/english1/2025.pdf'
    );
    expect(markdown).toContain(
      'english1-2025-paper (paper, usable, quality=needs_review, sha256=sha256:english1-paper): data/raw-inbox/public-course-2025/english1/2025-english1-paper.pdf'
    );
    expect(markdown).toContain(
      'english1-2025-answer (answer, usable, quality=needs_review, sha256=sha256:english1-answer): data/raw-inbox/public-course-2025/english1/2025-english1-answer.pdf'
    );
    expect(markdown).toContain('english1-2025-paper (paper');
    expect(markdown).toContain('<br>english1-2025-answer (answer');
    expect(markdown).toContain('| # | Workstream | Blocker | Target | Count | Next action |');
    expect(markdown).toContain('data/release-evidence/wechat-device-smoke.md');
  });

  it('surfaces blocked WeChat DevTools smoke as an explicit backlog workstream', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: { releaseReadiness: { canPublish: true }, summary: {}, coverage: { tracks: [] } },
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: {
        status: 'blocked',
        steps: [{ name: 'smoke-run', status: 'blocked', error: 'listen EPERM: operation not permitted 0.0.0.0' }]
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    expect(backlog.verdict).toBe('blocked');
    expect(backlog.items).toHaveLength(1);
    expect(backlog.items[0]).toMatchObject({
      workstream: 'wechat_devtools_smoke',
      blockerCode: 'wechat_devtools_smoke_not_passed'
    });

    const markdown = renderBacklogMarkdown(backlog);
    expect(markdown).toContain('WeChat DevTools Smoke 阻塞');
    expect(markdown).toContain('当前执行环境禁止本地端口监听');
  });

  it('distinguishes local source companion gaps before source-manifest registration', () => {
    const questionAudit = {
      summary: {
        requiredSlots: 2,
        publishedSlots: 0,
        pendingSlots: 2,
        pendingCoverageBlockerCount: 2,
        coverageGapCount: 0,
        sourceManifestPublishableOfficialPapers: 0,
        sourceManifestCoverageGapCount: 2
      },
      releaseReadiness: { canPublish: false },
      coverage: {
        tracks: [
          {
            track: 'english2',
            requiredYears: [2025],
            publishedYears: [],
            pendingYears: [2025],
            missingYears: []
          },
          {
            track: 'politics',
            requiredYears: [2025],
            publishedYears: [],
            pendingYears: [2025],
            missingYears: []
          }
        ]
      },
      sourceEvidence: {
        coverage: {
          english2: {
            presentYears: [],
            missingYears: [2025],
            missingYearDiagnostics: {
              2025: {
                candidateCount: 1,
                officialPaperCandidateCount: 1,
                blockReasons: { 'answerEvidenceStatus=missing': 1 },
                sampleCandidates: []
              }
            }
          },
          politics: {
            presentYears: [],
            missingYears: [2025],
            missingYearDiagnostics: {
              2025: {
                candidateCount: 1,
                officialPaperCandidateCount: 1,
                blockReasons: { 'answerEvidenceStatus=missing': 1 },
                sampleCandidates: []
              }
            }
          }
        }
      }
    };

    const backlog = buildReleaseBlockerBacklog({
      questionAudit,
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      localSourceAudit: {
        sources: [
          {
            id: 'english2-2025-paper',
            track: 'english2',
            year: '2025',
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/english2/2025-english2-paper.pdf',
            sha256: 'sha256:english2-paper',
            textLayer: 'usable',
            quality: 'needs_cleaning',
            blockers: []
          },
          {
            id: 'english2-2025-answer-partial',
            track: 'english2',
            year: '2025',
            role: 'answer',
            localPath: 'data/raw-inbox/public-course-2025/english2/2025-english2-answer-partial.pdf',
            sha256: 'sha256:english2-answer-partial',
            textLayer: 'usable',
            quality: 'needs_passage',
            blockers: ['source filename marks the answer as missing T1 and T4']
          },
          {
            id: 'politics-2025-paper',
            track: 'politics',
            year: '2025',
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/politics/2025-politics-paper.pdf',
            sha256: 'sha256:politics-paper',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          }
        ]
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    const english2Slot = backlog.publicCourseSlotBacklog.find((slot) => slot.track === 'english2');
    const politicsSlot = backlog.publicCourseSlotBacklog.find((slot) => slot.track === 'politics');

    expect(english2Slot.localSourceAuditSummary).toContain('companions=answer有阻塞');
    expect(english2Slot.nextAction).toContain('已有可读试卷，但答案文件仍有 1 个阻塞');
    expect(english2Slot.sourceManifestRegistrationChecklist).toMatchObject({
      status: 'blocked_before_auto_pair',
      readyForHumanVerification: false,
      verifiedSourceRegistryDrafts: [],
      blockers: ['local_answer_file_blocked'],
      localFileCandidates: [
        {
          role: 'paper',
          sha256: 'sha256:english2-paper',
          blockers: []
        },
        {
          role: 'answer',
          sha256: 'sha256:english2-answer-partial',
          blockers: ['source filename marks the answer as missing T1 and T4']
        }
      ]
    });
    expect(politicsSlot.localSourceAuditSummary).toContain('companions=缺answer');
    expect(politicsSlot.nextAction).toContain('已有可读试卷但缺少可用答案文件');
    expect(backlog.summary.sourceManifestHumanRegistrationQueue).toMatchObject({
      readySlotCount: 0,
      registryDraftCount: 0,
      nextSlotKey: ''
    });
    expect(backlog.sourceManifestHumanRegistrationQueue.slots).toEqual([]);
  });

  it('reports when a loaded local source audit has no files for the blocked slot', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: {
        summary: {
          requiredSlots: 1,
          publishedSlots: 0,
          pendingSlots: 1,
          pendingCoverageBlockerCount: 1,
          coverageGapCount: 0,
          sourceManifestPublishableOfficialPapers: 0,
          sourceManifestCoverageGapCount: 1
        },
        releaseReadiness: { canPublish: false },
        coverage: {
          tracks: [
            {
              track: 'politics',
              requiredYears: [2024, 2025],
              publishedYears: [],
              pendingYears: [2025],
              missingYears: [2024]
            }
          ]
        },
        sourceEvidence: {
          coverage: {
            politics: {
              presentYears: [],
              missingYears: [2024, 2025],
              missingYearDiagnostics: {
                2024: {
                  candidateCount: 1,
                  officialPaperCandidateCount: 1,
                  blockReasons: { 'answerEvidenceStatus=missing': 1 },
                  sampleCandidates: []
                },
                2025: {
                  candidateCount: 1,
                  officialPaperCandidateCount: 1,
                  blockReasons: { 'answerEvidenceStatus=missing': 1 },
                  sampleCandidates: []
                }
              }
            }
          }
        }
      },
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      localSourceAudit: {
        sources: [
          {
            id: 'english1-2025-paper',
            track: 'english1',
            year: '2025',
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-paper.pdf',
            sha256: 'sha256:english1-paper',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          }
        ],
        root: 'data/raw-inbox/public-course-2025'
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    const politics2025 = backlog.publicCourseSlotBacklog.find((slot) => slot.slotKey === 'politics:2025');
    const politics2024 = backlog.publicCourseSlotBacklog.find((slot) => slot.slotKey === 'politics:2024');

    expect(politics2025).toMatchObject({
      slotKey: 'politics:2025',
      localSourceAuditStatus: 'missing_for_slot',
      localSourceAuditSummary: 'local source audit 已加载，但该槽位未登记本地 paper/answer 文件。'
    });
    expect(politics2025.nextAction).toContain('该槽位没有本地 paper/answer 文件');
    expect(politics2024).toMatchObject({
      slotKey: 'politics:2024',
      localSourceAuditStatus: 'not_available',
      localSourceAuditSummary: ''
    });
    expect(backlog.nextBalancedPublicCourseSlots[0]).toMatchObject({
      track: 'politics',
      year: 2025,
      localSourceAuditStatus: 'missing_for_slot'
    });
  });

  it('recommends locally actionable pending slots before slots missing local files', () => {
    const questionAudit = {
      summary: {
        requiredSlots: 2,
        publishedSlots: 0,
        pendingSlots: 2,
        pendingCoverageBlockerCount: 2,
        coverageGapCount: 0,
        sourceManifestPublishableOfficialPapers: 0,
        sourceManifestCoverageGapCount: 2
      },
      releaseReadiness: { canPublish: false },
      coverage: {
        tracks: [
          {
            track: 'politics',
            requiredYears: [2025],
            publishedYears: [],
            pendingYears: [2025],
            missingYears: []
          },
          {
            track: 'english1',
            requiredYears: [2025],
            publishedYears: [],
            pendingYears: [2025],
            missingYears: []
          }
        ]
      },
      sourceEvidence: {
        coverage: {
          politics: {
            presentYears: [],
            missingYears: [2025],
            missingYearDiagnostics: {
              2025: {
                candidateCount: 1,
                officialPaperCandidateCount: 1,
                blockReasons: { 'answerEvidenceStatus=missing': 1 },
                sampleCandidates: []
              }
            }
          },
          english1: {
            presentYears: [],
            missingYears: [2025],
            missingYearDiagnostics: {
              2025: {
                candidateCount: 1,
                officialPaperCandidateCount: 1,
                blockReasons: { 'answerEvidenceStatus=missing': 1 },
                sampleCandidates: []
              }
            }
          }
        }
      }
    };

    const backlog = buildReleaseBlockerBacklog({
      questionAudit,
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      localSourceAudit: {
        root: 'data/raw-inbox/public-course-2025',
        sources: [
          {
            id: 'english1-2025-paper',
            track: 'english1',
            year: '2025',
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-paper.pdf',
            sha256: 'sha256:english1-paper',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          },
          {
            id: 'english1-2025-answer',
            track: 'english1',
            year: '2025',
            role: 'answer',
            localPath: 'data/raw-inbox/public-course-2025/english1/2025-english1-answer.pdf',
            sha256: 'sha256:english1-answer',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          }
        ]
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    expect(backlog.nextBalancedPublicCourseSlots.map((slot) => `${slot.track}:${slot.year}`)).toEqual([
      'english1:2025',
      'politics:2025'
    ]);
    expect(backlog.nextBalancedPublicCourseSlots[0].localSourceAuditSummary).toContain('paper+answer可读');
    expect(backlog.nextBalancedPublicCourseSlots[1]).toMatchObject({
      track: 'politics',
      year: 2025,
      localSourceAuditStatus: 'missing_for_slot'
    });
    expect(backlog.summary.publicCourseLocalSourceSummary).toMatchObject({
      totalBlockedSlots: 2,
      pairedReadableSlots: 1,
      missingLocalFileSlots: 1,
      needsOcrSlots: 0,
      notAvailableSlots: 0
    });
  });

  it('round-robins balanced public-course recommendations across tracks inside priority buckets', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: {
        summary: {
          requiredSlots: 5,
          publishedSlots: 0,
          pendingSlots: 4,
          pendingCoverageBlockerCount: 4,
          coverageGapCount: 1,
          sourceManifestPublishableOfficialPapers: 0,
          sourceManifestCoverageGapCount: 0
        },
        releaseReadiness: { canPublish: false },
        coverage: {
          tracks: [
            {
              track: 'english1',
              requiredYears: [2025, 2026],
              publishedYears: [],
              pendingYears: [2025, 2026],
              missingYears: []
            },
            {
              track: 'politics',
              requiredYears: [2024],
              publishedYears: [],
              pendingYears: [2024],
              missingYears: []
            },
            {
              track: 'math1',
              requiredYears: [2023],
              publishedYears: [],
              pendingYears: [2023],
              missingYears: []
            },
            {
              track: 'math2',
              requiredYears: [2005],
              publishedYears: [],
              pendingYears: [],
              missingYears: [2005]
            }
          ]
        },
        sourceEvidence: { coverage: {} }
      },
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    expect(backlog.nextBalancedPublicCourseSlots.map((slot) => `${slot.track}:${slot.year}`)).toEqual([
      'politics:2024',
      'english1:2026',
      'math1:2023',
      'english1:2025',
      'math2:2005'
    ]);
    expect(backlog.nextBalancedPublicCourseSlots.slice(0, 4).every((slot) => slot.slotStatus === 'pending')).toBe(true);
    expect(backlog.nextBalancedPublicCourseSlots.at(-1)).toMatchObject({
      track: 'math2',
      year: 2005,
      slotStatus: 'missing'
    });
  });

  it('keeps paper local-source samples before combined paper-answer evidence', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: {
        summary: {
          requiredSlots: 1,
          publishedSlots: 0,
          pendingSlots: 1,
          pendingCoverageBlockerCount: 1,
          coverageGapCount: 0,
          sourceManifestPublishableOfficialPapers: 0,
          sourceManifestCoverageGapCount: 1
        },
        releaseReadiness: { canPublish: false },
        coverage: {
          tracks: [
            {
              track: 'math1',
              requiredYears: [2025],
              publishedYears: [],
              pendingYears: [2025],
              missingYears: []
            }
          ]
        },
        sourceEvidence: {
          coverage: {
            math1: {
              presentYears: [],
              missingYears: [2025],
              missingYearDiagnostics: {
                2025: {
                  candidateCount: 1,
                  officialPaperCandidateCount: 1,
                  blockReasons: { 'answerEvidenceStatus=missing': 1 },
                  sampleCandidates: []
                }
              }
            }
          }
        }
      },
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      localSourceAudit: {
        root: 'data/raw-inbox/public-course-2025',
        sources: [
          {
            id: 'math1-2025-paper-answer',
            track: 'math1',
            year: 2025,
            role: 'paper_answer',
            localPath: 'data/raw-inbox/public-course-2025/math1/2025-math1-paper-answer.pdf',
            sha256: 'sha256:math1-paper-answer',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          },
          {
            id: 'math1-2025-paper',
            track: 'math1',
            year: 2025,
            role: 'paper',
            localPath: 'data/raw-inbox/public-course-2025/math1/2025-math1-paper.pdf',
            sha256: 'sha256:math1-paper',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          },
          {
            id: 'math1-2025-answer',
            track: 'math1',
            year: 2025,
            role: 'answer',
            localPath: 'data/raw-inbox/public-course-2025/math1/2025-math1-answer.pdf',
            sha256: 'sha256:math1-answer',
            textLayer: 'usable',
            quality: 'needs_review',
            blockers: []
          }
        ]
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    const slot = backlog.publicCourseSlotBacklog.find((item) => item.slotKey === 'math1:2025');

    expect(slot.localSourceAuditSamples.map((sample) => sample.role)).toEqual(['paper', 'paper_answer', 'answer']);
    expect(slot.sourceManifestRegistrationChecklist.localFileCandidates.map((sample) => sample.role)).toEqual([
      'paper',
      'paper_answer',
      'answer'
    ]);
    expect(slot.sourceManifestRegistrationChecklist).toMatchObject({
      status: 'auto_source_evidence_candidate',
      readyForHumanVerification: false,
      verifiedSourceRegistryDrafts: []
    });
    expect(backlog.sourceManifestHumanRegistrationQueue.nextReadySlot).toBeNull();
  });

  it('renders a concise markdown report for operators', () => {
    const backlog = buildReleaseBlockerBacklog({
      questionAudit: { releaseReadiness: { canPublish: true }, summary: {}, coverage: { tracks: [] } },
      flashcardQuality: { releaseReadiness: { canPromoteToPublic: true }, summary: {}, files: [] },
      externalAudit: { releaseReadiness: { canPublish: true }, summary: {}, sections: {} },
      wechatSmoke: { status: 'passed' },
      professionalIndex: {
        summary: { embeddedItems: 600, eligibleIndexSources: 13644, publicationMode: 'index_only' },
        items: Array.from({ length: 600 }, (_, index) => ({ id: `professional-${index}` }))
      },
      generatedAt: '2026-05-22T00:00:00.000Z'
    });

    const markdown = renderBacklogMarkdown(backlog);

    expect(backlog.verdict).toBe('passed');
    expect(markdown).toContain('Exam-Master 发布遗留阻塞 Backlog');
    expect(markdown).toContain('专业课索引');
    expect(markdown).toContain('embeddedItems: 600');
    expect(markdown).toContain('fullIndexItems: 13644');
  });
});
