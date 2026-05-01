/**
 * 资源 Store — MVP stub
 */
import { defineStore } from 'pinia';

export const useResourceStore = defineStore('resource', {
  state: () => ({
    resources: [],
    loading: false
  }),
  actions: {
    async loadResources() {
      return [];
    },
    async searchResources() {
      return [];
    }
  }
});
