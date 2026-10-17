
import { RLModule } from './src/core/rl';
import { RLState, RLAction } from './src/core/rl/types';

console.log('Testing Special Event System with PPO...');
console.log('='.repeat(60));

// 创建模块
const rlModule = new RLModule();
const specialEvents = rlModule.getSpecialEventSystem();
const ppoAgent = rlModule.getPPOAgent();

console.log('1. Starting episode...');
rlModule.startEpisode();

console.log('\n2. Triggering some events...');
// 触发几个不同类型的事件
specialEvents.trigger('TASK_COMPLETED', { action: 'test', result: 'success' });
console.log('- Triggered: TASK_COMPLETED (success)');

specialEvents.trigger('TASK_FAILED', { action: 'test', result: 'error' });
console.log('- Triggered: TASK_FAILED (failure)');

specialEvents.trigger('LOW_CONFIDENCE', { action: 'test', metrics: { confidence: 0.3 } });
console.log('- Triggered: LOW_CONFIDENCE (warning)');

console.log('\n3. Current event stats:', JSON.stringify(specialEvents.getStats(), null, 2));

console.log('\n4. Testing reward adjustment...');
const testReward = 10;
const adjustedReward = ppoAgent.adjustRewardForEvents(testReward);
console.log(`   Base reward: ${testReward}`);
console.log(`   Adjusted reward: ${adjustedReward}`);

console.log('\n5. Testing action selection with events...');
const testState: RLState = { 
  userId: 'test-user',
  currentInput: 'test', 
  conversationHistory: [], 
  availableTools: [],
  timeOfDay: 12,
  conversationTurns: 1,
  inputComplexity: 1
};
const action = ppoAgent.getAction(testState);
console.log(`   Selected action:`, action);

console.log('\n6. Recording an experience...');
rlModule.recordExperience(
  testState,
  action,
  testReward,
  testState,
  true
);

console.log('\n7. Ending episode...');
rlModule.endEpisode(true);

console.log('\n8. Full training stats:');
console.log(JSON.stringify(rlModule.getTrainingStats(), null, 2));

console.log('\n' + '='.repeat(60));
console.log('Test complete!');

