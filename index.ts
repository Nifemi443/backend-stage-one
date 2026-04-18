import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { Profile } from '@prisma/client';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { uuidv7 } from 'uuidv7';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const app = express();
app.use(express.json());
app.use(cors());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const getAgeGroup = (age: number): string => {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
};

// 1. POST /api/profiles
app.post('/api/profiles', async (req: Request, res: Response) => {
  const { name } = req.body;

  if (name === undefined || name === null || name === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }

  if (typeof name !== 'string') {
    return res.status(422).json({ status: "error", message: "Invalid type" });
  }

  if (name.trim() === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }

  try {
    const normalizedName = name.toLowerCase().trim();

    const existing = await prisma.profile.findUnique({ where: { name: normalizedName } });
    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: existing
      });
    }

    let genderRes: any, ageRes: any, nationRes: any;
    try {
      [genderRes, ageRes, nationRes] = await Promise.all([
        axios.get(`https://api.genderize.io?name=${normalizedName}`, { timeout: 5000 }),
        axios.get(`https://api.agify.io?name=${normalizedName}`, { timeout: 5000 }),
        axios.get(`https://api.nationalize.io?name=${normalizedName}`, { timeout: 5000 })
      ]);
    } catch (err: any) {
      return res.status(502).json({ status: "error", message: "Upstream or server failure", detail: err.message });
    }

    if (!genderRes.data.gender || genderRes.data.count === 0)
      return res.status(502).json({ status: "error", message: "Genderize returned an invalid response" });
    if (ageRes.data.age === null)
      return res.status(502).json({ status: "error", message: "Agify returned an invalid response" });
    if (!nationRes.data.country || nationRes.data.country.length === 0)
      return res.status(502).json({ status: "error", message: "Nationalize returned an invalid response" });

    const topCountry = nationRes.data.country.sort((a: any, b: any) => b.probability - a.probability)[0];

    const newProfile = await prisma.profile.create({
      data: {
        id: uuidv7(),
        name: normalizedName,
        gender: genderRes.data.gender,
        gender_probability: genderRes.data.probability,
        sample_size: genderRes.data.count,
        age: ageRes.data.age,
        age_group: getAgeGroup(ageRes.data.age),
        country_id: topCountry.country_id,
        country_probability: topCountry.probability,
      }
    });

    return res.status(201).json({ status: "success", data: newProfile });
  } catch (error) {
    console.error('POST /api/profiles error:', error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// 2. GET /api/profiles/:id
app.get('/api/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
    if (!profile) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }
    return res.status(200).json({ status: "success", data: profile });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// 3. GET /api/profiles
app.get('/api/profiles', async (req: Request, res: Response) => {
  try {
    const { gender, country_id, age_group } = req.query;
    const filters: any = {};
    if (gender) filters.gender = { equals: String(gender), mode: 'insensitive' };
    if (country_id) filters.country_id = { equals: String(country_id), mode: 'insensitive' };
    if (age_group) filters.age_group = { equals: String(age_group), mode: 'insensitive' };

    const profiles = await prisma.profile.findMany({ where: filters });
    return res.status(200).json({
      status: "success",
      count: profiles.length,
      data: profiles.map((p: Profile) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        age: p.age,
        age_group: p.age_group,
        country_id: p.country_id
      }))
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// 4. DELETE /api/profiles/:id
app.delete('/api/profiles/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.profile.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }
    await prisma.profile.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));