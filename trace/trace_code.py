import os
import fnmatch

# Directories and patterns to ignore
IGNORE_DIRS = {'.git', '.gitignore', '.next', 'node_modules', '.vscode', 'docs'}
IGNORE_FILES = {
    'package.json', 'package-lock.json', 'README.md', 'components.json',
    'tsconfig.json', 'next-env.d.ts', 'next.config.ts',
    'postcss.config.mjs', 'tailwind.config.ts', '.env', '.modified'
}

# File patterns for logic (backend/AI/service) and style (UI components)
LOGIC_PATTERNS = ['*.ts', '*.tsx', '*.js', '*.py']
# Directories to include for logic-only and logic+style
LOGIC_DIRS = ['src/ai', 'src/lib', 'src/services', 'src/middleware', 'src/hooks']
STYLE_DIRS = ['src/components', 'src/app']


def collect_paths(base_dir, dirs_include, patterns):
    """
    Collect files under base_dir in dirs_include matching patterns,
    excluding ignored directories and files.
    """
    matches = []
    for root, dirs, files in os.walk(base_dir):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        # Check if this root is within one of the included dirs
        rel = os.path.relpath(root, base_dir)
        if any(rel.startswith(d) for d in dirs_include):
            for pattern in patterns:
                for filename in fnmatch.filter(files, pattern):
                    if filename in IGNORE_FILES:
                        continue
                    matches.append(os.path.join(root, filename))
    return matches


def main():
    # Use current directory as repository root
    repo_path = os.getcwd()
    # Ensure output directory
    output_dir = os.path.join(repo_path, 'trace')
    os.makedirs(output_dir, exist_ok=True)

    # Trace logic files
    logic_files = collect_paths(repo_path, LOGIC_DIRS, LOGIC_PATTERNS)
    logic_output = os.path.join(output_dir, 'logic_files.txt')
    with open(logic_output, 'w') as f:
        for path in logic_files:
            f.write(path + os.linesep)

    # Trace logic + style files
    combined_dirs = LOGIC_DIRS + STYLE_DIRS
    all_files = collect_paths(repo_path, combined_dirs, LOGIC_PATTERNS)
    combined_output = os.path.join(output_dir, 'logic_style_files.txt')
    with open(combined_output, 'w') as f:
        for path in all_files:
            f.write(path + os.linesep)

    print(f"Logic file list saved to: {logic_output}")
    print(f"Logic+Style file list saved to: {combined_output}")


if __name__ == '__main__':
    main()
