import City from "lib/models/address/City";
import Country from "lib/models/address/Country";
import State from "lib/models/address/State";
import { NextApiRequest } from "next";
import { logError } from "./errorService";
import { Types } from "mongoose";

export async function findOrCreateLocationFromIP(req: NextApiRequest) {
    try {
        const clientIp = req.body?.clientIp || "";

        const ipUrl = clientIp ? `https://ipwho.is/${clientIp}` : `https://ipwho.is/`;
        const ipRes = await fetch(ipUrl);
        const ipData = await ipRes.json();

        const countryName = (ipData && ipData.success && ipData.country) ? ipData.country : "India";
        const regionName = (ipData && ipData.success && ipData.region) ? ipData.region : "Haryana";
        const cityName = (ipData && ipData.success && ipData.city) ? ipData.city : "Gurgaon";
        const countryCode = (ipData && ipData.success && ipData.country_code) ? ipData.country_code : "IN";

        let country = await Country.findOne({
            name: { $regex: new RegExp(`^${countryName.trim()}$`, 'i') }
        });
    
        if (!country) {
            country = await Country.create({
                name: countryName.trim(),
                capital: ipData?.capital || '',
                code: countryCode,
                calling_code: ipData?.calling_code || '',
                status: true,
            });
        }
    
        let state_id = null;
        let city_id = null;

        if (regionName) {
            let state = await State.findOne({
                country_id: country._id,
                name: { $regex: new RegExp(`^${regionName.trim()}$`, 'i') }
            });
    
            if (!state) {
                state = await State.create({
                    country_id: country._id,
                    name: regionName.trim(),
                    status: true,
                });
            }
            state_id = state._id;

            if (cityName && state_id) {
                let city = await City.findOne({
                    state_id: state_id,
                    name: { $regex: new RegExp(`^${cityName.trim()}$`, 'i') }
                });
    
                if (!city) {
                    city = await City.create({
                        state_id: state_id,
                        name: cityName.trim(),
                        status: true,
                    });
                }
                city_id = city._id;
            }
        }
    
        return { country_id: country._id, state_id, city_id };
    } catch (error) { await logError(error, { function: "findOrCreateLocationFromIP", payload: req.body }); return null; }
}

export async function seedCountryAndLocations() {
    try{
        const countriesInput = ["India"];
        const countriesList = Array.isArray(countriesInput) ? countriesInput : [countriesInput];
    
        const results = [];
    
        for (const rawName of countriesList) {
            if (!rawName || typeof rawName !== 'string') continue;
            const formattedCountry = rawName.trim();
    
            try {
                const response = await fetch("https://countriesnow.space/api/v0.5/countries/states/cities", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ country: formattedCountry })
                });
    
                const result = await response.json();
    
                if (result.error || !result.data) {
                    console.warn(`Could not fetch geographic data for "${formattedCountry}". Skipping.`);
                    continue;
                }
    
                const { country, iso2, states } = result.data;
    
                let countryDoc = await Country.findOne({
                    name: { $regex: new RegExp(`^${country.trim()}$`, 'i') }
                });
    
                if (!countryDoc) {
                    countryDoc = await Country.create({
                        name: country.trim(),
                        code: iso2 || '',
                        status: true,
                    });
                }
    
                let statesCreated = 0;
                let citiesCreated = 0;
    
                if (Array.isArray(states)) {
                    for (const stateObj of states) {
                        const stateName = stateObj.name;
                        if (!stateName) continue;
    
                        let stateDoc = await State.findOne({
                            country_id: countryDoc._id,
                            name: { $regex: new RegExp(`^${stateName.trim()}$`, 'i') }
                        });
    
                        if (!stateDoc) {
                            stateDoc = await State.create({
                                country_id: countryDoc._id,
                                name: stateName.trim(),
                                status: true,
                            });
                            statesCreated++;
                        }
                        const cities = stateObj.cities;
                        if (Array.isArray(cities)) {
                            for (const cityName of cities) {
                                if (!cityName) continue;
    
                                const existingCity = await City.findOne({
                                    state_id: stateDoc._id,
                                    name: { $regex: new RegExp(`^${cityName.trim()}$`, 'i') }
                                });
    
                                if (!existingCity) {
                                    await City.create({
                                        state_id: stateDoc._id,
                                        name: cityName.trim(),
                                        status: true,
                                    });
                                    citiesCreated++;
                                }
                            }
                        }
                    }
                }
    
                results.push({
                    country: country,
                    success: true,
                    states_created: statesCreated,
                    cities_created: citiesCreated
                });
            } catch (err) { console.error(`Error processing country ${rawName}:`, err); }
        }
    
        return { success: true, message: "Countries and locations seeded successfully.", data: results };
    }catch (error) { await logError(error, { function: "seedCountryAndLocations", payload: {} }); return null; }
}

export async function insertIndiaStates(): Promise<{countryId: Types.ObjectId; upsertedCount: number; modifiedCount: number; }> {
    const INDIA_STATES: string[] = [ 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Keralam', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', ];

    const indiaData = {
        name: 'India',
        capital: 'New Delhi',
        code: 'IN',
        calling_code: '+91',
        status: true,
        displayOrder: 1,
    };

    const indiaCountry = await Country.findOneAndUpdate(
        { $or: [{ code: 'IN' }, { name: 'India' }] },
        { $set: indiaData },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const countryId = indiaCountry._id;

    const operations = INDIA_STATES.map((name) => ({
        updateOne: {
        filter: { country_id: countryId, name },
        update: {
            $set: {
            country_id: countryId,
            name,
            major: null,
            status: true,
            displayOrder: null,
            },
        },
        upsert: true,
        },
    }));

    const result = await State.bulkWrite(operations, { ordered: false });

    return {
        countryId,
        upsertedCount: result.upsertedCount ?? 0,
        modifiedCount: result.modifiedCount ?? 0,
    };
}