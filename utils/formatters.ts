export const formatJobDescription = (description: string): string => {
    if (!description) return '';

    // Split into lines and handle bullet points
    const lines = description.split(/\r?\n/);
    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // If it starts with a common bullet char, convert to standard markdown dash
        // But avoid converting bold text (**) or italic (*) if not followed by a space
        if (/^[•◦▪▫∙‣⁃]/.test(trimmed) || /^[\-\*]\s+/.test(trimmed)) {
            return '- ' + trimmed.replace(/^[•◦▪▫∙‣⁃\-\*]\s*/, '');
        }

        // If line has significant leading indentation (3+ spaces), it's likely a bullet
        const match = line.match(/^(\s+)/);
        if (match && match[1].length >= 3) {
            return '- ' + trimmed;
        }

        return trimmed;
    }).filter(Boolean);

    const output: string[] = [];
    const items = processedLines as string[];

    const isHeading = (line: string) => /^#{1,6}\s+/.test(line);
    const isBullet = (line: string) => /^-\s+/.test(line);

    for (let i = 0; i < items.length; i += 1) {
        const line = items[i];
        const prev = output.length > 0 ? output[output.length - 1] : '';

        if (isHeading(line)) {
            if (prev) output.push('');
            output.push(line);

            // Convert consecutive plain lines after heading into bullets
            const buffer: string[] = [];
            let j = i + 1;
            while (j < items.length && items[j].trim() && !isHeading(items[j]) && !isBullet(items[j])) {
                buffer.push(items[j]);
                j += 1;
            }
            if (buffer.length >= 2) {
                output.push('');
                for (const b of buffer) {
                    output.push(`- ${b}`);
                }
                i = j - 1;
                continue;
            }

            if (i + 1 < items.length) {
                output.push('');
            }
            continue;
        }

        // Separate plain lines into paragraphs for better Markdown rendering
        if (prev && !isBullet(line) && !isHeading(line) && !isBullet(prev) && !isHeading(prev)) {
            output.push('');
        }
        output.push(line);
    }

    return output.join('\n');
};
