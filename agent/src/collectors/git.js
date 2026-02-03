import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { glob } from 'glob';

const DEFAULT_SCAN_PATHS = [
  join(homedir(), 'Documents'),
  join(homedir(), 'Projects'),
  join(homedir(), 'Code'),
  join(homedir(), 'dev'),
  join(homedir(), 'src'),
  join(homedir(), 'repos'),
  join(homedir(), 'workspace'),
  join(homedir(), 'workspaces'),
  join(homedir(), 'Github'),
  join(homedir(), 'Documents', 'Github'),
  join(homedir(), 'conductor'),
];

export async function collectGitMetrics(options = {}) {
  const {
    since = getDefaultSince(),
    author = await getGitAuthor(),
    scanPaths = DEFAULT_SCAN_PATHS,
    maxDepth = 3,
  } = options;

  const repos = await findGitRepos(scanPaths, maxDepth);

  const metrics = {
    collectedAt: new Date().toISOString(),
    author,
    since,
    reposScanned: repos.length,
    reposContributed: 0,
    totals: {
      commits: 0,
      linesAdded: 0,
      linesDeleted: 0,
      filesChanged: 0,
      pullRequests: 0,
    },
    byRepo: [],
    daily: {},
  };

  for (const repoPath of repos) {
    const repoMetrics = await getRepoMetrics(repoPath, author, since);

    if (repoMetrics && repoMetrics.commits > 0) {
      metrics.reposContributed++;
      metrics.totals.commits += repoMetrics.commits;
      metrics.totals.linesAdded += repoMetrics.linesAdded;
      metrics.totals.linesDeleted += repoMetrics.linesDeleted;
      metrics.totals.filesChanged += repoMetrics.filesChanged;

      metrics.byRepo.push({
        name: basename(repoPath),
        path: repoPath,
        ...repoMetrics,
      });

      // Merge daily stats
      for (const [date, dayStats] of Object.entries(repoMetrics.daily || {})) {
        if (!metrics.daily[date]) {
          metrics.daily[date] = { commits: 0, linesAdded: 0, linesDeleted: 0 };
        }
        metrics.daily[date].commits += dayStats.commits;
        metrics.daily[date].linesAdded += dayStats.linesAdded;
        metrics.daily[date].linesDeleted += dayStats.linesDeleted;
      }
    }
  }

  // Convert daily object to sorted array
  metrics.dailyArray = Object.entries(metrics.daily)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return metrics;
}

async function findGitRepos(scanPaths, maxDepth) {
  const repos = new Set();

  for (const basePath of scanPaths) {
    if (!existsSync(basePath)) continue;

    try {
      // Find all .git directories
      const pattern = join(basePath, '**/.git');
      const gitDirs = await glob(pattern, {
        maxDepth: maxDepth + 1, // +1 because .git is one level deeper
        dot: true,
        onlyDirectories: true,
        ignore: ['**/node_modules/**', '**/vendor/**', '**/.cache/**'],
      });

      for (const gitDir of gitDirs) {
        // Get the repo root (parent of .git)
        const repoPath = join(gitDir, '..');
        repos.add(repoPath);
      }
    } catch (error) {
      // Skip paths we can't access
    }
  }

  return Array.from(repos);
}

async function getRepoMetrics(repoPath, author, since) {
  try {
    // Get commit count and stats
    const logOutput = execSync(
      `git log --author="${author}" --since="${since}" --pretty=format:"%H|%ad" --date=short --shortstat`,
      { cwd: repoPath, encoding: 'utf-8', timeout: 10000 }
    ).trim();

    if (!logOutput) {
      return null;
    }

    const lines = logOutput.split('\n');
    let commits = 0;
    let linesAdded = 0;
    let linesDeleted = 0;
    let filesChanged = 0;
    const daily = {};
    let currentDate = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // Commit line: hash|date
        const [, date] = line.split('|');
        currentDate = date;
        commits++;

        if (!daily[date]) {
          daily[date] = { commits: 0, linesAdded: 0, linesDeleted: 0 };
        }
        daily[date].commits++;
      } else if (line.includes('insertion') || line.includes('deletion')) {
        // Stats line: "3 files changed, 50 insertions(+), 10 deletions(-)"
        const filesMatch = line.match(/(\d+) files? changed/);
        const insertMatch = line.match(/(\d+) insertions?\(\+\)/);
        const deleteMatch = line.match(/(\d+) deletions?\(-\)/);

        if (filesMatch) filesChanged += parseInt(filesMatch[1], 10);
        if (insertMatch) {
          const added = parseInt(insertMatch[1], 10);
          linesAdded += added;
          if (currentDate && daily[currentDate]) {
            daily[currentDate].linesAdded += added;
          }
        }
        if (deleteMatch) {
          const deleted = parseInt(deleteMatch[1], 10);
          linesDeleted += deleted;
          if (currentDate && daily[currentDate]) {
            daily[currentDate].linesDeleted += deleted;
          }
        }
      }
    }

    return {
      commits,
      linesAdded,
      linesDeleted,
      filesChanged,
      daily,
    };
  } catch (error) {
    // Repository might not have any matching commits
    return null;
  }
}

async function getGitAuthor() {
  try {
    // Try to get from global git config
    const email = execSync('git config --global user.email', { encoding: 'utf-8' }).trim();
    return email;
  } catch {
    // Fallback: try to get from any repo
    try {
      const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
      return email;
    } catch {
      return null;
    }
  }
}

function getDefaultSince() {
  // Default to 30 days ago
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// Get list of repos for user review
export async function listDiscoveredRepos(scanPaths = DEFAULT_SCAN_PATHS) {
  return findGitRepos(scanPaths, 3);
}
