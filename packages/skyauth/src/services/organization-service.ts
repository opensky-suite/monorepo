/**
 * Organization and Team Management Service
 * Issue #30: Implement organization/team management
 */

import { Pool } from "pg";
import type { Organization, Team, TeamMember, TeamRole } from "@opensky/types";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors.js";

export interface CreateOrganizationData {
  name: string;
  slug: string;
  domain?: string;
  ownerId: string;
}

export interface CreateTeamData {
  orgId: string;
  name: string;
  description?: string;
}

export class OrganizationService {
  constructor(private pool: Pool) {}

  // Organization Management
  async createOrganization(
    data: CreateOrganizationData,
  ): Promise<Organization> {
    // Validate slug format (lowercase alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      throw new ValidationError(
        "Slug must be lowercase alphanumeric with hyphens",
      );
    }

    // Check if slug already exists
    const existing = await this.pool.query(
      `SELECT id FROM organizations WHERE slug = $1`,
      [data.slug],
    );

    if (existing.rows.length > 0) {
      throw new ValidationError("Organization slug already exists");
    }

    const result = await this.pool.query<Organization>(
      `INSERT INTO organizations (name, slug, domain, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.slug, data.domain, data.ownerId],
    );

    return this.mapOrgRow(result.rows[0]);
  }

  async getOrganization(id: string): Promise<Organization> {
    const result = await this.pool.query<Organization>(
      `SELECT * FROM organizations WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Organization");
    }

    return this.mapOrgRow(result.rows[0]);
  }

  async getOrganizationBySlug(slug: string): Promise<Organization> {
    const result = await this.pool.query<Organization>(
      `SELECT * FROM organizations WHERE slug = $1`,
      [slug],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Organization");
    }

    return this.mapOrgRow(result.rows[0]);
  }

  async listUserOrganizations(userId: string): Promise<Organization[]> {
    // Get organizations where user is owner or team member
    const result = await this.pool.query<Organization>(
      `SELECT DISTINCT o.* FROM organizations o
       LEFT JOIN teams t ON t.org_id = o.id
       LEFT JOIN team_members tm ON tm.team_id = t.id
       WHERE o.owner_id = $1 OR tm.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => this.mapOrgRow(row));
  }

  async updateOrganization(
    id: string,
    userId: string,
    data: Partial<
      Omit<Organization, "id" | "ownerId" | "createdAt" | "updatedAt">
    >,
  ): Promise<Organization> {
    // Check if user is owner
    const org = await this.getOrganization(id);
    if (org.ownerId !== userId) {
      throw new ForbiddenError("Only organization owner can update");
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.slug) {
      fields.push(`slug = $${paramCount++}`);
      values.push(data.slug);
    }
    if (data.domain !== undefined) {
      fields.push(`domain = $${paramCount++}`);
      values.push(data.domain);
    }

    if (fields.length === 0) {
      return org;
    }

    values.push(id);

    const result = await this.pool.query<Organization>(
      `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values,
    );

    return this.mapOrgRow(result.rows[0]);
  }

  async deleteOrganization(id: string, userId: string): Promise<void> {
    const org = await this.getOrganization(id);
    if (org.ownerId !== userId) {
      throw new ForbiddenError("Only organization owner can delete");
    }

    await this.pool.query(`DELETE FROM organizations WHERE id = $1`, [id]);
  }

  // Team Management
  async createTeam(data: CreateTeamData): Promise<Team> {
    const result = await this.pool.query<Team>(
      `INSERT INTO teams (org_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.orgId, data.name, data.description],
    );

    return this.mapTeamRow(result.rows[0]);
  }

  async getTeam(id: string): Promise<Team> {
    const result = await this.pool.query<Team>(
      `SELECT * FROM teams WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Team");
    }

    return this.mapTeamRow(result.rows[0]);
  }

  async listOrganizationTeams(orgId: string): Promise<Team[]> {
    const result = await this.pool.query<Team>(
      `SELECT * FROM teams WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );

    return result.rows.map((row) => this.mapTeamRow(row));
  }

  async updateTeam(
    id: string,
    data: Partial<Pick<Team, "name" | "description">>,
  ): Promise<Team> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }

    values.push(id);

    const result = await this.pool.query<Team>(
      `UPDATE teams SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values,
    );

    return this.mapTeamRow(result.rows[0]);
  }

  async deleteTeam(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM teams WHERE id = $1`, [id]);
  }

  // Team Member Management
  async addTeamMember(
    teamId: string,
    userId: string,
    role: TeamRole = TeamRole.MEMBER,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3`,
      [teamId, userId, role],
    );
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Team member");
    }
  }

  async listTeamMembers(teamId: string): Promise<TeamMember[]> {
    const result = await this.pool.query<TeamMember>(
      `SELECT * FROM team_members WHERE team_id = $1 ORDER BY joined_at`,
      [teamId],
    );

    return result.rows.map((row) => this.mapTeamMemberRow(row));
  }

  async updateTeamMemberRole(
    teamId: string,
    userId: string,
    role: TeamRole,
  ): Promise<void> {
    const result = await this.pool.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`,
      [role, teamId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Team member");
    }
  }

  // Helper methods
  private mapOrgRow(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      domain: row.domain,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTeamRow(row: any): Team {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTeamMemberRow(row: any): TeamMember {
    return {
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role as TeamRole,
      joinedAt: row.joined_at,
    };
  }
}
