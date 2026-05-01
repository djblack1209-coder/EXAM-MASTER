/**
 * 学习引擎 Store — MVP stub
 */
import { defineStore } from 'pinia';

export const useStudyEngineStore = defineStore('study-engine', {
  state: () => ({
    currentSession: null,
    isStudying: false
  }),
  actions: {
    async startSession() {
      return null;
    },
    async endSession() {
      return null;
    },
    async getProgress() {
      return { total: 0, completed: 0 };
    }
  }
});
