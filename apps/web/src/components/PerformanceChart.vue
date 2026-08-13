<script setup lang="ts">
import type { SeasonStat } from '../player-data'
defineProps<{ stats: SeasonStat[] }>()
</script>
<template>
  <div class="performance-chart">
    <div class="chart-legend"><span><i class="goal-dot"></i>进球</span><span><i class="assist-dot"></i>助攻</span></div>
    <div class="bars">
      <div v-for="season in stats" :key="season.season" class="bar-group">
        <div class="bar-values"><span :style="{height:`${Math.max(season.goals*8,8)}px`}" :title="`${season.goals} 球`"><b>{{ season.goals }}</b></span><span :style="{height:`${Math.max(season.assists*8,8)}px`}" :title="`${season.assists} 助攻`"><b>{{ season.assists }}</b></span></div>
        <strong>{{ season.season }}</strong><small>{{ season.appearances }} 场</small>
      </div>
    </div>
  </div>
</template>
