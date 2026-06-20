import path from 'path';

/**
 * Resolves a requested file or directory path against a base directory and ensures
 * that the resolved path is strictly contained within the base directory.
 * This mitigates Path Traversal vulnerabilities.
 *
 * @param baseDir The absolute path to the intended root directory.
 * @param requestedPath The relative or absolute path provided by an untrusted source.
 * @returns The resolved absolute path if safe, or null if a traversal attempt is detected.
 */
export function getSafeFilePath(baseDir: string, requestedPath: string): string | null {
    // Resolve the intended base directory to its absolute, canonical form
    const canonicalBase = path.resolve(baseDir);
    
    // Resolve the requested path relative to the base directory
    const canonicalTarget = path.resolve(canonicalBase, requestedPath);

    // Ensure the target still starts with the base directory + path separator
    // Adding the separator prevents trailing directory name collisions (e.g., /uploads vs /uploads-backup)
    if (canonicalTarget.startsWith(canonicalBase + path.sep) || canonicalTarget === canonicalBase) {
        return canonicalTarget;
    }

    return null;
}
