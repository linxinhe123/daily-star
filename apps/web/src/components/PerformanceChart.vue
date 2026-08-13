<script setup lang="ts">
import { getFootballAsset } from '../player-data'
import type { SeasonStat } from '../player-data'
defineProps<{ stats: SeasonStat[] }>()
</script>
<template>
  <div class="season-list">
    <article v-for="season in [...stats].reverse()" :key="season.season" class="season-card">
      <header>
        <span class="season-club"><img v-if="getFootballAsset(season.club)" :src="getFootballAsset(season.club)?.src" :alt="season.club"><b v-else>{{ season.club.slice(0,1) }}</b></span>
        <div><strong>{{ season.season }}</strong><small>{{ season.club }}</small></div>
      </header>
      <dl>
        <div><dt>出场</dt><dd>{{ season.appearances }}</dd></div>
        <div><dt>进球</dt><dd>{{ season.goals }}</dd></div>
        <div><dt>助攻</dt><dd>{{ season.assists }}</dd></div>
      </dl>
    </article>
  </div>
</template>
