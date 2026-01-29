export const formatJobDescription = (description: string): string => {
    if (!description) return '';

    // Split into lines and handle bullet points
    const lines = description.split(/\r?\n/);
    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // If it starts with a common bullet char, convert to standard markdown dash
        if (/^[•◦▪▫∙‣⁃\-\*]/.test(trimmed)) {
            return '- ' + trimmed.replace(/^[•◦▪▫∙‣⁃\-\*]\s*/, '');
        }

        // If line has significant leading indentation (3+ spaces), it's likely a bullet
        const match = line.match(/^(\s+)/);
        if (match && match[1].length >= 3) {
            return '- ' + trimmed;
        }

        return trimmed;
    }).filter(Boolean);

    return (processedLines as string[]).join('\n');
};
