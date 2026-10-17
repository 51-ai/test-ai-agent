/**
 * 会议纪要智能体 - 演示脚本
 * 
 * 运行方式: npx ts-node src/scenarios/meeting-notes/demo/run-demo.ts
 * 
 * @module scenarios/meeting-notes/demo
 */

import { MeetingNotesAgent } from '../../../core/scenarios/meeting-notes/MeetingNotesAgent';

/**
 * 演示用例
 */
const DEMO_CASES = {
  productReview: {
    name: '产品评审会议',
    content: `
产品评审会议 - 2024年Q2功能规划

会议参与人：张三（产品）、李四（研发）、王五（设计）、赵六（测试）

会议内容：
1. 张三介绍了Q2的产品规划，主要有三个方向：A功能优化、B新功能开发、C用户体验提升。

2. 关于A功能优化，李四提出了技术实现上的困难，认为需要2周时间。王五补充说设计上需要改版，可能需要额外1周。

3. 经过讨论，大家一致认为A功能是核心需求，必须优先完成。

4. 关于B功能，李四说技术方案还在探索中，建议延后到Q3。

5. 张三决定，下周三再开一次评审会，确认A功能的最终方案。

任务分配：
@张三 完成A功能的产品需求文档，本周五前
@李四 完成A功能的技术方案设计，下周一前
@王五 完成A功能的UI设计稿，下周二前
`,
    type: '产品评审会',
    title: '2024年Q2功能规划评审'
  },

  weeklyMeeting: {
    name: '周例会',
    content: `
周例会 - 项目进度同步

参与人：全体团队成员

本周工作汇报：
1. 张三完成了用户调研报告，发现用户对登录速度反馈较差。

2. 李四汇报了API接口优化工作，已完成80%，预计周五完成。

3. 王五介绍了新设计的登录页面，需要大家评审。

4. 赵六测试了支付模块，发现了一个bug，已反馈给李四修复。

下周计划：
- 张三：整理用户调研报告，准备用户访谈
- 李四：修复支付bug，完成API优化
- 王五：根据反馈调整登录设计
- 赵六：继续支付模块测试

问题：
- 服务器带宽可能不够，需要申请扩容
`,
    type: '周例会',
    title: '第12周工作例会'
  },

  brainStorm: {
    name: '头脑风暴',
    content: `
头脑风暴会议 - 用户增长策略

参与人：市场部全员

讨论主题：如何提升用户留存率

讨论内容：
1. 张三提出可以增加用户激励机制，如积分系统。

2. 李四建议做用户分层运营，针对不同用户提供差异化服务。

3. 王五认为应该优化新用户引导流程，降低流失。

4. 赵六提出可以做用户召回活动，给流失用户发优惠券。

5. 大家讨论后决定，先做用户分层，然后针对高价值用户提供VIP服务。

决策：
- 优先实现用户分层功能
- 同步开发积分激励系统

待办：
@市场部 整理用户分层需求文档
@技术部 评估实现方案
`,
    type: '头脑风暴',
    title: '用户增长策略讨论'
  },

  oneOnOne: {
    name: '一对一沟通',
    content: `
一对一沟通 - 员工发展讨论

沟通人：领导、张三

沟通内容：
1. 领导询问张三最近的工作状态，张三表示压力较大。

2. 领导建议张三适当调整工作节奏，注意休息。

3. 张三提出想学习更多技术方面的知识。

4. 领导同意安排张三参加下个月的技术培训。

5. 双方讨论了张三的职业发展方向，张三表示希望往技术专家方向发展。

6. 领导布置了一个新任务：优化团队的代码审查流程。

待办：
@张三 整理代码审查优化建议文档
@张三 安排技术培训报名
@张三 下周五前提交个人发展规划
`,
    type: '一对一沟通',
    title: '张三绩效发展沟通'
  }
};

/**
 * 运行单个演示
 */
async function runSingleDemo(caseName: string): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`   演示: ${caseName}`);
  console.log('='.repeat(60) + '\n');

  const demoCase = DEMO_CASES[caseName as keyof typeof DEMO_CASES];
  
  if (!demoCase) {
    console.log(`❌ 未找到演示用例: ${caseName}`);
    console.log('可用的演示用例:');
    Object.keys(DEMO_CASES).forEach(key => {
      console.log(`  - ${key}: ${(DEMO_CASES as any)[key].name}`);
    });
    return;
  }

  const agent = new MeetingNotesAgent();

  const result = await agent.execute({
    meetingContent: demoCase.content.trim(),
    meetingType: demoCase.type,
    meetingTitle: demoCase.title,
    participants: []
  });

  console.log(result.meetingMinutes);

  console.log('\n📊 统计信息:');
  console.log(`   执行时间: ${result.metadata.executionTime}ms`);
  console.log(`   置信度: ${(result.metadata.confidence * 100).toFixed(0)}%`);
  console.log(`   待办事项: ${result.summary.actionItems.length}项`);
}

/**
 * 运行所有演示
 */
async function runAllDemos(): Promise<void> {
  console.log('='.repeat(60));
  console.log('   会议纪要智能体 - 完整演示');
  console.log('='.repeat(60));

  const agent = new MeetingNotesAgent();

  for (const [key, demoCase] of Object.entries(DEMO_CASES)) {
    console.log('\n' + '='.repeat(60));
    console.log(`   演示 ${key}: ${demoCase.name}`);
    console.log('='.repeat(60) + '\n');

    const result = await agent.execute({
      meetingContent: demoCase.content.trim(),
      meetingType: demoCase.type,
      meetingTitle: demoCase.title,
      participants: []
    });

    console.log(result.meetingMinutes);
    console.log(`\n⏱️ 执行时间: ${result.metadata.executionTime}ms`);
  }
}

/**
 * 快速测试（使用默认内容）
 */
async function quickTest(): Promise<void> {
  console.log('🚀 快速测试模式\n');

  const agent = new MeetingNotesAgent();

  const result = await agent.execute({
    meetingContent: `
会议讨论了产品上线计划。
张三负责前端开发，预计2周完成。
李四负责后端开发，预计3周完成。
王五负责测试工作。
决策：下周一正式上线。
@张三 完成首页开发，本周五前
@李四 完成接口开发，下周一前
@王五 完成测试用例编写
    `.trim(),
    meetingType: '周例会',
    meetingTitle: '产品上线协调会',
    participants: ['张三', '李四', '王五']
  });

  console.log('\n' + '='.repeat(60));
  console.log('   生成结果');
  console.log('='.repeat(60) + '\n');
  console.log(result.meetingMinutes);

  console.log('\n📊 统计:');
  console.log(`   ✅ 成功率: ${result.success}`);
  console.log(`   ⏱️ 耗时: ${result.metadata.executionTime}ms`);
  console.log(`   🎯 置信度: ${(result.metadata.confidence * 100).toFixed(0)}%`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'quick';

  switch (command) {
    case 'quick':
      await quickTest();
      break;
    case 'all':
      await runAllDemos();
      break;
    case 'productReview':
    case 'weeklyMeeting':
    case 'brainStorm':
    case 'oneOnOne':
      await runSingleDemo(command);
      break;
    case 'list':
      console.log('可用的演示用例:');
      Object.entries(DEMO_CASES).forEach(([key, demo]) => {
        console.log(`  npx ts-node run-demo.ts ${key}  - ${demo.name}`);
      });
      break;
    default:
      console.log('使用方法:');
      console.log('  npx ts-node run-demo.ts quick        - 快速测试');
      console.log('  npx ts-node run-demo.ts all          - 运行所有演示');
      console.log('  npx ts-node run-demo.ts list         - 列出所有用例');
      console.log('  npx ts-node run-demo.ts productReview - 产品评审会议');
      console.log('  npx ts-node run-demo.ts weeklyMeeting - 周例会');
      console.log('  npx ts-node run-demo.ts brainStorm   - 头脑风暴');
      console.log('  npx ts-node run-demo.ts oneOnOne     - 一对一沟通');
  }
}

// 执行
if (require.main === module) {
  main().catch(console.error);
}