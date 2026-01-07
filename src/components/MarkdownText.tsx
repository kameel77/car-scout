import React from 'react';

interface MarkdownTextProps {
    text: string;
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
                    const isExternal = linkMatch[2].startsWith('http');
                    return (
                        <a
                            key={index}
                            href={linkMatch[2]}
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
