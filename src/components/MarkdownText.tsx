import React from 'react';

interface MarkdownTextProps {
    text: string;
}

// Only allow relative URLs, or absolute URLs with a safe protocol. Blocks
// javascript:, data:, vbscript:, etc. Protocol-relative URLs (//evil.com) are
// treated as unsafe since they resolve to an absolute, attacker-controlled host.
function safeHref(url: string): string | undefined {
    const trimmed = url.trim();
    // Strip control characters (and any whitespace hiding among them) that
    // browsers ignore when parsing a URL's scheme, e.g. "  JaVaScRiPt:alert(1)".
    // eslint-disable-next-line no-control-regex
    const normalized = trimmed.replace(/[\x00-\x20]/g, '');

    if (normalized.startsWith('//')) return undefined;
    if (normalized.startsWith('/') || normalized.startsWith('#') || normalized.startsWith('?')) {
        return trimmed;
    }

    // Anything else must be an absolute URL with an explicit, allow-listed protocol.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return undefined;

    try {
        const protocol = new URL(trimmed).protocol.toLowerCase();
        if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:') {
            return trimmed;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

/**
 * A simple component to safely render basic Markdown:
 * - **bold**
 * - [link text](url)
 */
export function MarkdownText({ text }: MarkdownTextProps) {
    if (!text) return null;

    // Regex to match **bold** or [link](url)
    // Part 1: \*\*(.*?)\*\* (Bold)
    // Part 2: \[(.*?)\]\((.*?)\) (Link)
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                // Match bold: **text**
                const boldMatch = part.match(/^\*\*(.*)\*\*$/);
                if (boldMatch) {
                    return <strong key={index} className="font-bold text-foreground">{boldMatch[1]}</strong>;
                }

                // Match link: [text](url)
                const linkMatch = part.match(/^\[(.*)\]\((.*)\)$/);
                if (linkMatch) {
                    const href = safeHref(linkMatch[2]);
                    if (!href) {
                        return <span key={index}>{linkMatch[1]}</span>;
                    }
                    const isExternal = href.startsWith('http');
                    return (
                        <a
                            key={index}
                            href={href}
                            target={isExternal ? '_blank' : undefined}
                            rel={isExternal ? 'noopener noreferrer' : undefined}
                            className="text-primary hover:underline font-medium"
                        >
                            {linkMatch[1]}
                        </a>
                    );
                }

                // Plain text
                return <span key={index}>{part}</span>;
            })}
        </>
    );
}
