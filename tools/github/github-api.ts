/**
 * GitHub API Client
 * Direct REST API usage (avoiding gh CLI which uses GraphQL and is rate-limited for bots)
 */

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

interface GitHubIssue {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: number;
}

interface GitHubLabel {
  name: string;
  color: string;
  description: string;
}

export class GitHubAPI {
  private baseUrl = "https://api.github.com";
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Labels
  async createLabel(label: GitHubLabel): Promise<void> {
    await this.request(
      "POST",
      `/repos/${this.config.owner}/${this.config.repo}/labels`,
      label,
    );
  }

  async getLabels(): Promise<GitHubLabel[]> {
    return this.request<GitHubLabel[]>(
      "GET",
      `/repos/${this.config.owner}/${this.config.repo}/labels`,
    );
  }

  async deleteLabel(name: string): Promise<void> {
    await this.request(
      "DELETE",
      `/repos/${this.config.owner}/${this.config.repo}/labels/${encodeURIComponent(name)}`,
    );
  }

  // Issues
  async createIssue(
    issue: GitHubIssue,
  ): Promise<{ number: number; html_url: string }> {
    return this.request<{ number: number; html_url: string }>(
      "POST",
      `/repos/${this.config.owner}/${this.config.repo}/issues`,
      issue,
    );
  }

  async listIssues(params?: {
    state?: "open" | "closed" | "all";
    labels?: string;
    per_page?: number;
    page?: number;
  }): Promise<
    Array<{
      number: number;
      title: string;
      state: string;
      labels: Array<{ name: string }>;
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params?.state) queryParams.set("state", params.state);
    if (params?.labels) queryParams.set("labels", params.labels);
    if (params?.per_page)
      queryParams.set("per_page", params.per_page.toString());
    if (params?.page) queryParams.set("page", params.page.toString());

    const query = queryParams.toString();
    const endpoint = `/repos/${this.config.owner}/${this.config.repo}/issues${query ? `?${query}` : ""}`;

    return this.request("GET", endpoint);
  }

  async updateIssue(
    issueNumber: number,
    update: {
      state?: "open" | "closed";
      labels?: string[];
      assignees?: string[];
    },
  ): Promise<void> {
    await this.request(
      "PATCH",
      `/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
      update,
    );
  }

  // Milestones
  async createMilestone(milestone: {
    title: string;
    description: string;
    due_on?: string;
  }): Promise<{ number: number }> {
    return this.request<{ number: number }>(
      "POST",
      `/repos/${this.config.owner}/${this.config.repo}/milestones`,
      milestone,
    );
  }

  async listMilestones(): Promise<
    Array<{ number: number; title: string; state: string }>
  > {
    return this.request(
      "GET",
      `/repos/${this.config.owner}/${this.config.repo}/milestones`,
    );
  }

  // Repository info
  async getRepo(): Promise<{
    name: string;
    owner: { login: string };
    private: boolean;
  }> {
    return this.request(
      "GET",
      `/repos/${this.config.owner}/${this.config.repo}`,
    );
  }

  // Pull Requests
  async createPullRequest(pr: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{ number: number; html_url: string }> {
    return this.request<{ number: number; html_url: string }>(
      "POST",
      `/repos/${this.config.owner}/${this.config.repo}/pulls`,
      pr,
    );
  }

  async listPullRequests(params?: {
    state?: "open" | "closed" | "all";
    per_page?: number;
  }): Promise<
    Array<{
      number: number;
      title: string;
      state: string;
      head: { ref: string };
      html_url: string;
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params?.state) queryParams.set("state", params.state);
    if (params?.per_page)
      queryParams.set("per_page", params.per_page.toString());

    const query = queryParams.toString();
    return this.request(
      "GET",
      `/repos/${this.config.owner}/${this.config.repo}/pulls${query ? `?${query}` : ""}`,
    );
  }

  async mergePullRequest(
    prNumber: number,
    commitTitle?: string,
  ): Promise<void> {
    await this.request(
      "PUT",
      `/repos/${this.config.owner}/${this.config.repo}/pulls/${prNumber}/merge`,
      {
        commit_title: commitTitle,
        merge_method: "squash",
      },
    );
  }
}
