# AGENTS.md — GitHub

The only GitHub Actions workflow is [`.github/workflows/dist.yml`](workflows/dist.yml). On pushes to `master` it builds `dist-exe` for the Linux, macOS, and Windows runtime targets, and an unsigned Desktop AppImage for each Linux architecture. Do not add other workflows. Issue templates, Dependabot updates for the npm and uv registries, and the local issue-management and review-ownership scripts stay here. Those scripts are not started by Actions.
