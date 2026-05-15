// chatPersist.js — DB persistence for chat history (logged-in users only).
//
// Anonymous users never call any of these; their conversations stay in component state.
//
// Schema (created by migration_9_chat_backend.sql):
//   chat_conversations(id, user_id, title, created_at, updated_at)
//   chat_messages(id, conversation_id, role, content, retrieved_content_ids[], created_at)

import { supabase } from './supabase'

// Title is the first user message truncated to ~60 chars — enough to recognize later.
export function deriveTitle(firstUserMessage) {
  const t = (firstUserMessage || '').trim().replace(/\s+/g, ' ')
  return t.length > 60 ? t.slice(0, 58).trim() + '…' : t
}

export async function createConversation(userId, title) {
  const { data, error } = await supabase.from('chat_conversations')
    .insert({ user_id: userId, title })
    .select('id, user_id, title, created_at, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function appendMessage(conversationId, role, content, retrievedContentIds = null) {
  const payload = { conversation_id: conversationId, role, content }
  if (retrievedContentIds && retrievedContentIds.length > 0) {
    payload.retrieved_content_ids = retrievedContentIds
  }
  const { data, error } = await supabase.from('chat_messages')
    .insert(payload)
    .select('id, conversation_id, role, content, retrieved_content_ids, created_at')
    .single()
  if (error) throw error
  // Bump the conversation's updated_at so it sorts to the top of the sidebar.
  await supabase.from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  return data
}

export async function listConversations(userId) {
  const { data, error } = await supabase.from('chat_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function loadConversation(conversationId) {
  const { data, error } = await supabase.from('chat_messages')
    .select('id, role, content, retrieved_content_ids, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function deleteConversation(conversationId) {
  const { error } = await supabase.from('chat_conversations')
    .delete()
    .eq('id', conversationId)
  if (error) throw error
}
