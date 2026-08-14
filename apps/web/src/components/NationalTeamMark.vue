<script setup lang="ts">
import { computed } from 'vue'
import { Shield } from 'lucide-vue-next'
import { getNationalTeamBadge } from '../national-team-assets'

const props = withDefaults(defineProps<{ nation: string; label?: boolean }>(), { label: true })
const badge = computed(() => getNationalTeamBadge(props.nation))
</script>

<template>
  <span class="national-team-mark" :title="`${nation}国家队`">
    <img v-if="badge" :src="badge" alt="">
    <Shield v-else aria-hidden="true" />
    <span v-if="label">{{ nation }}</span>
  </span>
</template>
