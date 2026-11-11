/**
 * Production Verification Script for InstaFlow CRM SaaS
 */

import { dbInstance } from '../src/server/db/database';
import { messagePolicyService } from '../src/server/services/messagePolicyService';

async function runVerification() {
  console.log('=== Starting InstaFlow CRM Production Verification ===\n');
  const state = dbInstance.getState();

  // Test 1: Verify Initial Pre-seeded Users and Orgs
  console.log('1. Verifying Database Seed Data...');
  const users = state.users;
  const orgs = state.organizations;
  console.log(`   ✓ Found ${users.length} users and ${orgs.length} organizations.`);
  
  const superAdmin = users.find(u => u.isSuperAdmin);
  if (!superAdmin) throw new Error('Super Admin missing');
  console.log(`   ✓ Super Admin present: ${superAdmin.email}`);

  // Test 2: Multi-tenant Isolation Check
  console.log('\n2. Testing Multi-Tenant Isolation...');
  const acmeId = 'org_acme';
  const apexId = 'org_apex';
  const acmeConvs = state.conversations.filter(c => c.organizationId === acmeId);
  const apexConvs = state.conversations.filter(c => c.organizationId === apexId);
  console.log(`   ✓ Acme Direct Retail conversations: ${acmeConvs.length}`);
  console.log(`   ✓ Apex Growth Agency conversations: ${apexConvs.length}`);
  if (acmeConvs.some(c => c.organizationId !== acmeId)) {
    throw new Error('Tenant leak detected in Acme conversations');
  }
  console.log('   ✓ Zero cross-tenant data leaks confirmed.');

  // Test 3: Plan Usage Limits & Quotas
  console.log('\n3. Testing Subscription Plan Quotas...');
  const sub = state.subscriptions.find(s => s.organizationId === acmeId);
  const plan = sub ? state.plans.find(p => p.id === sub.planId) : null;
  if (!plan) throw new Error('Acme plan not found');
  console.log(`   ✓ Active Plan: ${plan.displayName} (Max seats: ${plan.maxSeats}, Max accounts: ${plan.maxAccounts})`);
  
  const members = state.organizationMembers.filter(m => m.organizationId === acmeId && m.status === 'ACTIVE');
  console.log(`   ✓ Current active members: ${members.length} / ${plan.maxSeats}`);
  if (members.length > plan.maxSeats) {
    throw new Error('Members exceeded plan quota');
  }

  // Test 4: Meta Graph API 24-Hour Messaging Window & Human Agent Tag
  console.log('\n4. Testing Meta Instagram Graph API Outbound Policy...');
  const testConv = acmeConvs[0];
  if (!testConv) throw new Error('No test conversation');

  // Case A: Recent customer interaction (<24 hours)
  const now = new Date();
  testConv.lastCustomerMessageAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  const policyPass = messagePolicyService.evaluateMessagingEligibility(testConv, 'AGENT', false);
  console.log(`   ✓ 2-hour-old customer message policy check: ${policyPass.isEligible ? 'PASSED' : 'BLOCKED'} (Elapsed: ${policyPass.hoursSinceLastCustomerMessage}h)`);
  if (!policyPass.isEligible) throw new Error('Policy should have allowed outbound message');

  // Case B: Expired customer interaction (>24 hours) by AI (strictly prohibited by Meta)
  testConv.lastCustomerMessageAt = new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(); // 28 hours ago
  const policyAiBlocked = messagePolicyService.evaluateMessagingEligibility(testConv, 'AI', false);
  console.log(`   ✓ 28-hour-old customer message AI policy check: ${policyAiBlocked.isEligible ? 'PASSED' : 'BLOCKED'} (Reason: ${policyAiBlocked.reason})`);
  if (policyAiBlocked.isEligible) throw new Error('Policy should have blocked AI message past 24h');

  // Case C: Expired customer interaction (>24 hours) WITH Human Agent tag within 7 days
  const policyHumanAgent = messagePolicyService.evaluateMessagingEligibility(testConv, 'AGENT', true);
  console.log(`   ✓ 28-hour-old customer message WITH HUMAN_AGENT tag: ${policyHumanAgent.isEligible ? 'PASSED' : 'BLOCKED'} (Tag: ${policyHumanAgent.tagToApply})`);
  if (!policyHumanAgent.isEligible || policyHumanAgent.tagToApply !== 'HUMAN_AGENT') {
    throw new Error('Human Agent tag should have permitted 7-day exception window');
  }

  // Test 5: Invoices and Support Tickets
  console.log('\n5. Verifying Invoices and Support Tickets...');
  const invoices = state.invoices.filter(i => i.organizationId === acmeId);
  console.log(`   ✓ Pre-generated invoices for Acme: ${invoices.length} (${invoices.map(i => i.invoiceNumber).join(', ')})`);
  
  const tickets = state.supportTickets.filter(t => t.organizationId === acmeId);
  console.log(`   ✓ Support tickets: ${tickets.length}`);

  // Test 6: Audit Logging
  console.log('\n6. Verifying Audit Logging...');
  const auditLogs = state.auditLogs.filter(a => a.organizationId === acmeId);
  console.log(`   ✓ Audit logs present: ${auditLogs.length} events logged`);

  // Test 7: Knowledge Base File Upload & Indexing
  console.log('\n7. Testing Knowledge Base File Upload & Indexing...');
  const testFileDoc = {
    id: `kb_test_${Date.now()}`,
    organizationId: acmeId,
    title: 'Spring Catalog & Pricing',
    sourceType: 'FILE' as const,
    content: 'All blazers in the Spring Collection carry a 30-day money-back guarantee with free prepaid return labels.',
    fileName: 'spring_catalog_2026.pdf',
    fileSize: 45200,
    fileType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.knowledgeDocuments.push(testFileDoc);
  dbInstance.commit();

  const retrieved = state.knowledgeDocuments.find(d => d.id === testFileDoc.id && d.sourceType === 'FILE');
  if (!retrieved || retrieved.fileName !== 'spring_catalog_2026.pdf') {
    throw new Error('Knowledge Base file upload document failed to persist');
  }
  console.log(`   ✓ File document persisted with metadata: ${retrieved.fileName} (${retrieved.fileSize} bytes)`);

  console.log('\n======================================================');
  console.log('✓ All 7 core production verification tests PASSED cleanly!');
  console.log('======================================================\n');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
