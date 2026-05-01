import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA_DIR = path.resolve(process.cwd(), 'laf-backend/database-schema');

function readSchema(fileName) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, fileName), 'utf8'));
}

function indexNames(schema) {
  return (schema.indexes || []).map((item) => item.name);
}

describe('question bank knowledge schema contracts', () => {
  it('defines source evidence required for publishable past-exam questions', () => {
    const schema = readSchema('source_evidence.schema.json');

    expect(schema.required).toEqual(
      expect.arrayContaining(['question_id', 'source_id', 'answer_evidence_status', 'question_text_hash'])
    );
    expect(schema.properties.answer_evidence_status.enum).toContain('matched');
    expect(schema.properties.answer_evidence_status.enum).toContain('unmatched');
    expect(indexNames(schema)).toEqual(expect.arrayContaining(['idx_question', 'idx_source', 'idx_answer_evidence']));
  });

  it('defines the backend knowledge graph node and edge contracts', () => {
    const nodeSchema = readSchema('knowledge_nodes.schema.json');
    const edgeSchema = readSchema('knowledge_edges.schema.json');

    expect(nodeSchema.required).toEqual(expect.arrayContaining(['node_id', 'level', 'name', 'tracks']));
    expect(nodeSchema.properties.level.enum).toEqual(['subject', 'track', 'module', 'topic', 'micro_point']);
    expect(indexNames(nodeSchema)).toEqual(expect.arrayContaining(['idx_node_id', 'idx_parent', 'idx_tracks_level']));

    expect(edgeSchema.required).toEqual(expect.arrayContaining(['edge_id', 'source_node_id', 'target_node_id', 'relation']));
    expect(edgeSchema.properties.relation.enum).toEqual(
      expect.arrayContaining(['contains', 'prerequisite', 'confusable_with'])
    );
    expect(indexNames(edgeSchema)).toEqual(expect.arrayContaining(['idx_source_relation', 'idx_target_relation']));
  });

  it('defines question-to-knowledge mapping and user mastery state contracts', () => {
    const mappingSchema = readSchema('question_knowledge_edges.schema.json');
    const stateSchema = readSchema('user_knowledge_state.schema.json');

    expect(mappingSchema.required).toEqual(expect.arrayContaining(['question_id', 'node_id', 'confidence', 'source']));
    expect(mappingSchema.properties.source.enum).toEqual(expect.arrayContaining(['rule', 'ai', 'manual']));
    expect(indexNames(mappingSchema)).toEqual(expect.arrayContaining(['idx_question', 'idx_node', 'idx_primary']));

    expect(stateSchema.required).toEqual(expect.arrayContaining(['user_id', 'node_id', 'attempts', 'color_state']));
    expect(stateSchema.properties.color_state.enum).toEqual(['unknown', 'primed', 'strong', 'watch', 'weak']);
    expect(indexNames(stateSchema)).toEqual(expect.arrayContaining(['idx_user_node', 'idx_user_color', 'idx_user_updated']));
  });
});
