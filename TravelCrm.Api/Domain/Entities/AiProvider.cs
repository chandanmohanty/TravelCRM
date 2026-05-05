namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Supported LLM providers. Add new entries when plugging in additional
/// vendors (Azure OpenAI, Google Gemini, …). The integer values are stored
/// in the database, so append new entries at the end — do not reorder.
/// </summary>
public enum AiProvider
{
    Anthropic = 1,   // Claude (claude-3-5-sonnet, claude-3-opus, …)
    OpenAI    = 2,   // GPT-4o, GPT-4, GPT-3.5
}
