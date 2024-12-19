// ===================================
// Classes and Core Game Logic
// ===================================

let gameData = {}; // To store loaded game data

async function loadGameData() {
  try {
    const response = await fetch('game-data.json');
    if (!response.ok) throw new Error('Failed to load game data');

    gameData = await response.json();
    console.log('[DEBUG] Game data loaded:', gameData);

    initializeGameFromData();
  } catch (error) {
    console.error('Error loading game data:', error);
  }
}

let skipActive = false; // Flag to track skip action
let countdownInterval = null; // Track the interval to clear on banner switch

// Resource Manager
class ResourceManager {
  constructor() {
    this.resources = new Map([
      ['crystallizedXP', 0],
      ['soulGems', 100]
    ]);
  }

  addResource(type, amount) {
    if (this.resources.has(type)) {
      this.resources.set(type, this.resources.get(type) + amount);
      this.updateResourceDisplay(); // Update UI when resources change
    } else {
      console.error(`Resource type ${type} does not exist.`);
    }
  }

  useResource(type, amount) {
    if (this.resources.has(type) && this.resources.get(type) >= amount) {
      this.resources.set(type, this.resources.get(type) - amount);
      this.updateResourceDisplay(); // Update UI when resources change
      return true;
    } else {
      console.log(`Not enough ${type} available.`);
      return false;
    }
  }

  getResourceAmount(type) {
    return this.resources.get(type) || 0;
  }

  updateResourceDisplay() {
    // Update resource values in the UI
    document.getElementById('resource-xp').textContent = this.getResourceAmount('crystallizedXP');
    document.getElementById('resource-gems').textContent = this.getResourceAmount('soulGems');
  }
}


// Elemental Wheel
class ElementalWheel {
  constructor() {
    this.elements = {
      'Fire': 'Water',
      'Water': 'Electric',
      'Electric': 'Earth',
      'Earth': 'Wind',
      'Wind': 'Fire',
      'Light': 'Dark',
      'Dark': 'Light'
    };
  }

  getWeakness(element) {
    return this.elements[element] || null;
  }
}

// Character
class Character {
  constructor(name, baseRarity, element, assignedWeaponClass) {
    this.name = name;
    this.baseRarity = baseRarity;
    this.currentRarity = baseRarity; // Current rarity may change due to awakening
    this.element = element;
    this.assignedWeaponClass = assignedWeaponClass;

    this.level = 1;
    this.awakening = 0;
    this.duplicates = 0;

    this.weapon = null;
    this.hp = this.calculateBaseStat('hp');
    this.maxHp = this.hp;
    this.energy = 0;
    this.isAlly = true;

    // Base stats
    this.baseStats = {
      atk: this.calculateBaseStat('atk'),
      def: this.calculateBaseStat('def'),
      speed: this.calculateBaseStat('speed'),
      energyRecharge: this.calculateBaseStat('energyRecharge'),
      critChance: this.calculateBaseStat('critChance'),
      critDamage: this.calculateBaseStat('critDamage')
    };
    this.growthRate = this.getGrowthRates(); // Growth rates per rarity
    this.currentStats = { ...this.baseStats };

    // Skills
    this.skill1 = null;
    this.skill2 = null;
    this.passive = null;
  }

  // Max level depends on the character's rarity
  getMaxLevel() {
    const rarityLevels = {
      '3-star': 60,
      '4-star': 80,
      '5-star': 100,
      '6-star': 120,
    };
    return rarityLevels[this.currentRarity] || 60;
  }

  // Calculate base stats based on rarity and level
  calculateBaseStat(stat) {
    const baseStats = {
      '3-star': { hp: 800, atk: 20, def: 15, speed: 100, energyRecharge: 1.0, critChance: 5, critDamage: 1.5 },
      '4-star': { hp: 1000, atk: 25, def: 20, speed: 120, energyRecharge: 1.2, critChance: 10, critDamage: 1.75 },
      '5-star': { hp: 1200, atk: 30, def: 25, speed: 140, energyRecharge: 1.5, critChance: 15, critDamage: 2.0 }
    };
    return baseStats[this.baseRarity][stat] || 0;
  }
  getGrowthRates() {
    return {
      '3-star': { hp: 60, atk: 1.5, def: 1.2, speed: 2, energyRecharge: 0.05, critChance: 0.2, critDamage: 0.05 },
      '4-star': { hp: 75, atk: 2, def: 1.6, speed: 2.5, energyRecharge: 0.07, critChance: 0.3, critDamage: 0.1 },
      '5-star': { hp: 90, atk: 2.5, def: 2, speed: 3, energyRecharge: 0.1, critChance: 0.5, critDamage: 0.2 }
    }[this.baseRarity] || {};
  }

  // Set character skills
  setSkills(skill1, skill2, passive) {
    this.skill1 = skill1;
    this.skill2 = skill2;
    this.passive = passive;
  }

  // Level up logic
  levelUp() {
    if (this.level >= this.getMaxLevel()) {
      console.log(`${this.name} is already at max level.`);
      return false;
    }

    const cost = this.calculateLevelUpCost();
    if (resourceManager.useResource('crystallizedXP', cost)) {
      this.level++;
      this.applyStatGrowth();
      this.updateStats();
      console.log(`${this.name} leveled up to ${this.level}!`);
      return true;
    } else {
      console.log(`Not enough Crystallized XP to level up ${this.name}. Required: ${cost}`);
      return false;
    }
  }

  calculateLevelUpCost() {
    const baseCost = gameData.balance.levelUpCostBase; // Starting base cost
    const growthRate = gameData.balance.levelUpCostPerLevel; // Growth factor per level
    const scalingExponent = 1.1; // k value for quadratic scaling (adjustable between 0.8 - 1.2)
    return Math.round(baseCost + growthRate * Math.pow((this.level - 1), scalingExponent));
  }

  // Recalculate stats after leveling up or equipping a weapon
  updateStats() {
    this.currentStats = { ...this.baseStats };
  
    // Add weapon bonuses if a weapon is equipped
    if (this.weapon && this.weapon.baseStats) {
      const weaponStats = this.weapon.getCurrentStats();
      Object.entries(weaponStats).forEach(([stat, value]) => {
        if (stat in this.currentStats) {
          this.currentStats[stat] = roundToTwoDecimals(this.currentStats[stat] + value);
        }
      });
    }
  }
  

  applyStatGrowth() {
    const growth = this.growthRate;
    if (!growth) {
      return;
    }
    // Apply growth to each stat
    this.baseStats.hp = roundToTwoDecimals(this.baseStats.hp + growth.hp);
    this.baseStats.atk = roundToTwoDecimals(this.baseStats.atk + growth.atk);
    this.baseStats.def = roundToTwoDecimals(this.baseStats.def + growth.def);
    this.baseStats.speed = roundToTwoDecimals(this.baseStats.speed + growth.speed);
    this.baseStats.energyRecharge = roundToTwoDecimals(this.baseStats.energyRecharge + growth.energyRecharge);
    this.baseStats.critChance = roundToTwoDecimals(Math.min(this.baseStats.critChance + growth.critChance, 100)); // Cap at 100%
    this.baseStats.critDamage = roundToTwoDecimals(this.baseStats.critDamage + growth.critDamage);
  
    // Preserve proportional HP
    const hpPercentage = this.hp / this.maxHp;
    this.maxHp = roundToTwoDecimals(this.maxHp + growth.hp);
    this.hp = Math.floor(this.maxHp * hpPercentage); // Scale current HP based on max HP
  }
  


  rechargeEnergy() {
    this.energy = Math.min(100, this.energy + this.energyRecharge * 10); // Example multiplier for recharge rate
    console.log(`${this.name}'s energy recharged to ${Math.floor(this.energy)}`);
  }

  // Awakening logic to improve stats and potentially increase rarity
  awaken() {
    if (this.duplicates <= 0) {
      console.log(`${this.name} cannot awaken - insufficient duplicates.`);
      return false;
    }
  
    this.duplicates--;
    this.awakening++;
  
    // Apply awakening boosts
    this.hp = Math.floor(this.hp * 1.1);
    this.currentStats.atk = Math.floor(this.currentStats.atk * 1.1);
    this.currentStats.def = Math.floor(this.currentStats.def * 1.1);
    this.currentStats.speed = Math.floor(this.currentStats.speed * 1.1); // Use currentStats.speed
    this.currentStats.energyRecharge = Math.min(this.currentStats.energyRecharge + 0.1, 2.0); // Cap recharge
  
    console.log(
      `${this.name} awakened to level ${this.awakening}. Stats: HP: ${this.hp}, ATK: ${this.currentStats.atk}, DEF: ${this.currentStats.def}, SPEED: ${this.currentStats.speed}, ENERGY RECHARGE: ${this.currentStats.energyRecharge}`
    );
  
    if (this.awakening >= 5) {
      this.promoteRarity();
    }
  
    return true;
  }
  
  promoteRarity() {
    const rarities = ['3-star', '4-star', '5-star', '6-star'];
    const currentIndex = rarities.indexOf(this.currentRarity);
  
    if (currentIndex < rarities.length - 1) {
      const newRarity = rarities[currentIndex + 1];
      console.log(`${this.name} is being promoted from ${this.currentRarity} to ${newRarity}`);
  
      this.currentRarity = newRarity;
      this.awakening = 0;
  
      // Apply significant boosts during rarity promotion
      this.hp = Math.floor(this.hp * 1.2);
      this.currentStats.atk = Math.floor(this.currentStats.atk * 1.2);
      this.currentStats.def = Math.floor(this.currentStats.def * 1.2);
      this.currentStats.speed = Math.floor(this.currentStats.speed * 1.2);
      this.currentStats.energyRecharge = Math.min(this.currentStats.energyRecharge + 0.2, 2.0); // Cap recharge
  
      console.log(
        `${this.name} promoted to ${this.currentRarity}. Stats increased significantly!`
      );
    } else {
      console.log(`${this.name} is already at maximum rarity (${this.currentRarity}).`);
    }
  }

  addDuplicate() {
    this.duplicates++;
    console.log(`${this.name} now has ${this.duplicates} duplicate(s).`);
  }

  // Equip a weapon and update stats
  equipWeapon(weapon) {
    if (weapon.type !== this.assignedWeaponClass) {
      console.error(`[DEBUG] ${this.name} cannot equip ${weapon.name}. This weapon is not a ${this.assignedWeaponClass}.`);
      return false;
    }

    if (this.weapon) {
      console.log(`[DEBUG] Unequipping current weapon: ${this.weapon.name}`);
      this.weapon.equippedBy = null;
    }

    console.log(`[DEBUG] Equipping ${weapon.name} to ${this.name}.`);
    this.weapon = weapon;
    weapon.equippedBy = this;
    this.updateStats();
    return true;
  }

  // Unequip weapon and reset stats
  unequipWeapon() {
    if (this.weapon) {
      console.log(`[DEBUG] Unequipping ${this.weapon.name} from ${this.name}.`);
      this.weapon.equippedBy = null;
      this.weapon = null;
    }
    this.updateStats();
  }

  // Reset HP and energy
  reset() {
    this.hp = this.maxHp;
    this.energy = 0;
  }
}

// Weapon
class Weapon {
  constructor(name, rarity, baseStats, type) {
    this.name = name;
    this.rarity = rarity;
    this.type = type;
    this.baseStats = baseStats;
    this.maxLevel = this.getMaxLevel();
    this.level = 1;
    this.awakened = false;
    this.equippedBy = null;
    this.enhancementXP = 0;
    this.xpToNextLevel = this.calculateXPRequired();
    this.locked = false;
  }

  getMaxLevel() {
    switch (this.rarity) {
      case '3-star':
        return 50;
      case '4-star':
        return 70;
      case '5-star':
        return 90;
    }
  }

  getTypeBonus() {
    const typeMultipliers = {
      'Sword': { atk: 1.2, def: 1.0 },
      'Bow': { atk: 1.4, def: 0.8 },
      'Polearm': { atk: 1.1, def: 1.1 },
      'Axe': { atk: 1.3, def: 0.9 },
      'Magic': { atk: 1.5, def: 0.7 }
    };
    return typeMultipliers[this.type] || { atk: 1.0, def: 1.0 };
  }

  addEnhancementXP(sacrificedWeapon) {
    // Base XP values for each rarity
    const baseXPValues = {
      '3-star': 100,
      '4-star': 200,
      '5-star': 500
    };
  
    // Calculate base XP
    let gainedXP = baseXPValues[sacrificedWeapon.rarity];
  
    // Add XP for weapon levels above 1
    gainedXP += (sacrificedWeapon.level - 1) * 20;
  
    // Apply the highest applicable multiplier
    let multiplier = 1;
  
    // Check for same weapon (highest priority)
    if (sacrificedWeapon.name === this.name) {
      multiplier = 2;
    }
    // Check for matching weapon type
    else if (sacrificedWeapon.type === this.type) {
      multiplier = 1.5;
    }
  
    // Apply the multiplier
    gainedXP *= multiplier;
  
    // Add the XP to the weapon
    this.enhancementXP += gainedXP;
  
    // Level up if enough XP is gained
    while (this.enhancementXP >= this.xpToNextLevel && this.level < this.maxLevel) {
      this.enhancementXP -= this.xpToNextLevel;
      this.levelUp();
      this.xpToNextLevel = this.calculateXPRequired();
    }

    if (this.equippedBy) {
      console.log(`[DEBUG] Updating stats for ${this.equippedBy.name} due to weapon enhancement.`);
      this.equippedBy.updateStats();
    }
  
    console.log(`${this.name} gained ${gainedXP} XP from sacrificing ${sacrificedWeapon.name}`);
    return gainedXP;
  }
  

  calculateXPRequired() {
    const baseXP = 100;
    const rarityMultiplier = {
      '3-star': 1,
      '4-star': 1.5,
      '5-star': 2
    };
    return Math.floor(baseXP * rarityMultiplier[this.rarity] * this.level);
  }


  getCurrentStats() {
    const levelMultiplier = 1 + (this.level - 1) * 0.1;
    const awakenedMultiplier = this.awakened ? 1.2 : 1;
    const typeBonus = this.getTypeBonus();

    return {
      atk: Math.floor(this.baseStats.atk * levelMultiplier * awakenedMultiplier * typeBonus.atk),
      def: Math.floor(this.baseStats.def * levelMultiplier * awakenedMultiplier * typeBonus.def)
    };
  }

  levelUp() {
    if (this.level >= this.maxLevel) {
      console.log(`${this.name} is already at max level`);
      return false;
    }

    this.level++;
    this.xpToNextLevel = this.calculateXPRequired();
    this.updateStats();
    console.log(`${this.name} leveled up to ${this.level}`);
    return true;
  }

  updateStats() {
    const multiplier = 1 + (this.level - 1) * 1.5;
    const awakenBonus = this.awakened ? 0.2 : 0;
    this.stats = Object.fromEntries(
      Object.entries(this.baseStats).map(([key, value]) =>
        [key, Math.floor(value * (multiplier + awakenBonus))]
      )
    );
  }

  getStatRanges() {
    const baseRanges = {
      '3-star': { atk: [50, 100], def: [30, 60] },
      '4-star': { atk: [100, 150], def: [60, 90] },
      '5-star': { atk: [150, 200], def: [90, 120] }
    };
  
    const typeModifiers = {
      'Sword': { atk: 1.2, def: 1.0 },
      'Bow': { atk: 1.4, def: 0.8 },
      'Polearm': { atk: 1.1, def: 1.1 },
      'Axe': { atk: 1.3, def: 0.9 },
      'Magic': { atk: 1.5, def: 0.7 }
    };
  
    const levelScaling = 1 + (this.level - 1) * 0.05; // 5% increase per level
  
    const baseRange = baseRanges[this.rarity];
    const typeModifier = typeModifiers[this.type] || { atk: 1, def: 1 };
  
    return {
      atk: [
        Math.round(baseRange.atk[0] * typeModifier.atk * levelScaling),
        Math.round(baseRange.atk[1] * typeModifier.atk * levelScaling)
      ],
      def: [
        Math.round(baseRange.def[0] * typeModifier.def * levelScaling),
        Math.round(baseRange.def[1] * typeModifier.def * levelScaling)
      ]
    };
  }
  
  

  awaken(resourceManager, fodderWeapon) {
    const awakenCost = 500;
    if (!this.canAwakenWith(fodderWeapon)) {
      console.log("Cannot awaken with the provided weapon.");
      return false;
    }
    if (!resourceManager.useResource('soulGems', awakenCost)) {
      console.log("Not enough Soul Gems to awaken this weapon.");
      return false;
    }
    this.awakening++;
    console.log(`${this.name} awakened to rank ${this.awakening}`);
    return true;
  }

  canAwakenWith(fodderWeapon) {
    return fodderWeapon && fodderWeapon.name === this.name && fodderWeapon.rarity === this.rarity && fodderWeapon.isFullyLeveled() && this.awakening < 5;
  }

  isFullyLeveled() {
    return this.level === this.getMaxLevel();
  }

  toggleLock() {
    console.log(`${this.name} lock status changing from ${this.locked} to ${!this.locked}`);
    this.locked = !this.locked;
    return this.locked;
  }
}

// Ability
class Ability {
  constructor(name, description, effect, cooldown) {
    this.name = name;
    this.description = description;
    this.effect = effect;
    this.cooldown = cooldown;
    this.currentCooldown = 0;
  }

  use(caster, targets) {
    if (this.currentCooldown === 0) {
      const result = this.effect(caster, targets);
      this.currentCooldown = this.cooldown;
      return result;
    }
    return null;
  }

  reduceCooldown() {
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }
  }
}

// Character Manager
class CharacterManager {
  constructor() {
    this.characterDefinitions = {};
    this.ownedCharacters = {};
    this.abilities = {};
  }

  defineAbility(abilityName, ability) {
    this.abilities[abilityName] = ability;
  }

  defineCharacter(name, baseRarity, element, skill1Name, skill2Name, passiveName, weaponClass) {
    const skill1 = this.abilities[skill1Name];
    const skill2 = this.abilities[skill2Name];
    const passive = this.abilities[passiveName];
  
    if (!skill1 || !skill2 || !passive) {
      console.error(`[DEBUG] One or more abilities not found for character: ${name}`);
      return;
    }
  
    this.characterDefinitions[name] = {
      name,
      baseRarity,
      element,
      skill1Name,
      skill2Name,
      passiveName,
      assignedWeaponClass: weaponClass
    };
  
    console.log(`[DEBUG] Defined character: ${name}, Rarity: ${baseRarity}, Element: ${element}, Weapon Class: ${weaponClass}`);
  }
  

  addOwnedCharacter(name) {
    const characterDef = this.characterDefinitions[name];
  
    if (characterDef) {
      if (!this.ownedCharacters[name]) {
        const { baseRarity, element, skill1Name, skill2Name, passiveName , assignedWeaponClass} = characterDef;
  
        const newCharacter = new Character(name, baseRarity, element, assignedWeaponClass);
        newCharacter.setSkills(
          this.abilities[skill1Name],
          this.abilities[skill2Name],
          this.abilities[passiveName]
        );
  
        this.ownedCharacters[name] = newCharacter;
  
        console.log(`[DEBUG] Added owned character: ${name}`);
      } else {
        this.ownedCharacters[name].addDuplicate();
        console.log(`[DEBUG] Added duplicate for character: ${name}`);
      }
    } else {
      console.warn(`[DEBUG] Character definition not found for: ${name}`);
    }
  }  

  getOwnedCharacter(name) {
    return this.ownedCharacters[name];
  }

  getAllOwnedCharacters() {
    return Object.values(this.ownedCharacters);
  }

  levelUpCharacter(name, resourceManager) {
    const character = this.getOwnedCharacter(name);
    if (character) {
      const availableXP = resourceManager.getResourceAmount('crystallizedXP');
      const xpUsed = character.levelUp(availableXP);
      if (xpUsed > 0) {
        resourceManager.useResource('crystallizedXP', xpUsed);
        characterCollection.renderCharacterDetails();
        return true;
      }
    } else {
      console.log(`Character ${name} not found.`);
    }
    return false;
  }

  awakenCharacter(name) {
    const character = this.getOwnedCharacter(name);
    if (character) {
      return character.awaken();
    }
    return false;
  }
}

// Weapon Manager
class WeaponManager {
  constructor() {
    this.weapons = [];
  }

  filterWeaponsForCharacter(character) {
    return this.weapons.filter(weapon => weapon.type === character.assignedWeaponClass);
  }

  addWeapon(weapon) {
    if (!(weapon instanceof Weapon)) {
      throw new Error("Invalid weapon object.");
    }
    this.weapons.push(weapon);
    console.log(`Added weapon: ${weapon.name} (Rarity: ${weapon.rarity})`);
  }

  enhanceWeapon(targetWeapon, sacrificeWeapon) {
    if (!targetWeapon || !sacrificeWeapon) {
      console.log('Invalid weapon selection');
      return false;
    }

    if (targetWeapon === sacrificeWeapon) {
      console.log('Cannot sacrifice the same weapon');
      return false;
    }

    if (sacrificeWeapon.equippedBy) {
      console.log('Cannot sacrifice equipped weapon');
      return false;
    }

    targetWeapon.addEnhancementXP(sacrificeWeapon);

    // Remove sacrificed weapon from manager
    const index = this.weapons.indexOf(sacrificeWeapon);
    if (index > -1) {
      this.weapons.splice(index, 1);
    }

      // Refresh Character Details if weapon is equipped
  if (targetWeapon.equippedBy) {
    targetWeapon.equippedBy.updateStats();
    console.log(`[DEBUG] Stats updated for ${targetWeapon.equippedBy.name}`);
    characterCollection.updateCharacterDetails();
  }

    return true;
  }

  awakenWeapon(weapon, resourceManager) {
    const fodder = this.weapons.find(w => w !== weapon && w.name === weapon.name && w.rarity === weapon.rarity && w.isFullyLeveled());
    if (!fodder) {
      console.log(`No fully leveled copy of ${weapon.name} found for awakening.`);
      return false;
    }
    const success = weapon.awaken(resourceManager, fodder);
    if (success) {
      this.weapons = this.weapons.filter(w => w !== fodder);
    }
    return success;
  }

  assignWeaponToCharacter(character, weapon) {
    if (weapon.equippedBy && weapon.equippedBy !== character) {
        console.log(`Unequipping ${weapon.name} from ${weapon.equippedBy.name}.`);
        weapon.equippedBy.unequipWeapon();
    }
    character.equipWeapon(weapon);

    // Update Character Collection UI after equipping weapon
    characterCollection.renderCharacters();
    characterCollection.updateCharacterDetails();
}



  listWeapons() {
    this.weapons.forEach(w => {
      const stats = w.getCurrentStats();
      console.log(`${w.name} (R${w.rarity}, L${w.level}, A${w.awakening}) - ATK: ${stats.atk}, DEF: ${stats.def}${w.equippedBy ? ' [Equipped by ' + w.equippedBy.name + ']' : ''}`);
    });
  }
}

// ComplexRandomGenerator
class ComplexRandomGenerator {
  constructor(poolSize) {
    this.pool = Array.from({ length: poolSize }, (_, i) => i);
    this.currentIndex = poolSize - 1;
  }

  reset() {
    this.currentIndex = this.pool.length - 1;
  }

  getRandomNumber() {
    if (this.currentIndex < 0) {
      this.reset();
    }
    const randomIndex = Math.floor(Math.random() * (this.currentIndex + 1));
    [this.pool[randomIndex], this.pool[this.currentIndex]] = [this.pool[this.currentIndex], this.pool[randomIndex]];
    this.currentIndex--;
    return this.pool[this.currentIndex + 1];
  }
}

// Banner
class Banner {
  constructor(name, featured5Star, featured4Stars, duration, startTime) {
    this.name = name;
    this.featured5Star = featured5Star;
    this.featured4Stars = featured4Stars;
    this.duration = duration;
    this.startTime = startTime || Date.now();
  }

  isActive() {
    const now = Date.now();
    return now >= this.startTime && now <= this.startTime + this.duration;
  }
}

// Enemy Factory
class EnemyFactory {
  constructor() {
    this.baseStats = {
      'Fire': { hp: 100, atk: 15, def: 5, speed: 100, energyRecharge: 1.0 },
      'Water': { hp: 120, atk: 10, def: 10, speed: 90, energyRecharge: 1.2 },
      'Earth': { hp: 150, atk: 8, def: 15, speed: 80, energyRecharge: 1.1 },
      'Wind': { hp: 90, atk: 12, def: 7, speed: 110, energyRecharge: 1.3 },
      'Electric': { hp: 110, atk: 14, def: 9, speed: 105, energyRecharge: 1.5 }
    };

    this.skills = {
      'Fire': { 1: 'Flame Strike', 2: 'Blazing Heat' },
      'Water': { 1: 'Aqua Jet', 2: 'Tidal Wave' },
      'Earth': { 1: 'Rock Smash', 2: 'Earthquake' },
      'Wind': { 1: 'Gust Arrow', 2: 'Storm Gust' },
      'Electric': { 1: 'Spark Shock', 2: 'Thunder Clap' }
    };
  }

  createEnemy(stage) {
    const element = this.getRandomElement();
    const baseStats = this.baseStats[element];
    const scale = 1 + (stage - 1) * 0.1; // Scale stats by stage level

    console.log(`Generated enemy stats:`, {
      hp: Math.floor(baseStats.hp * scale),
      atk: Math.floor(baseStats.atk * scale),
      def: Math.floor(baseStats.def * scale),
      speed: Math.floor(baseStats.speed * scale),
      energyRecharge: baseStats.energyRecharge + stage * 0.05
    });
    

    return {
      name: `${element} Elemental`,
      element: element,
      hp: Math.floor(baseStats.hp * scale),
      maxHp: Math.floor(baseStats.hp * scale),
      atk: Math.floor(baseStats.atk * scale),
      def: Math.floor(baseStats.def * scale),
      speed: Math.floor(baseStats.speed * scale), // Scaled speed
      energy: 0, // Starts at 0
      isAlly: false, // Mark as enemy
      currentStats: {
        atk: Math.floor(baseStats.atk * scale),
        def: Math.floor(baseStats.def * scale),
        speed: Math.floor(baseStats.speed * scale),
        energyRecharge: baseStats.energyRecharge + stage * 0.05, // Scaled energy recharge
        critChance: Math.min(10 + stage * 0.5, 50), // Enemies' crit chance scales with stage
        critDamage: 1.5 + stage * 0.05, // Enemies' crit damage scales with stage
      },
      skill1: this.generateSkill(element, 1),
      skill2: this.generateSkill(element, 2)
    };
  }

  generateEnemies(stage) {
    const enemyCount = Math.min(Math.floor(Math.random() * 3) + 3, 5); // 3-5 enemies per stage
    return Array.from({ length: enemyCount }, () => this.createEnemy(stage));
  }

  getRandomElement() {
    const elements = Object.keys(this.baseStats);
    return elements[Math.floor(Math.random() * elements.length)];
  }

  generateSkill(element, skillNumber) {
    return {
      name: this.skills[element][skillNumber],
      damage: 10 + skillNumber * 5 // Simple damage calculation for skills
    };
  }
}

// ===================================
// Global Instances
// ===================================

const resourceManager = new ResourceManager();
const elementalWheel = new ElementalWheel();
const characterManager = new CharacterManager();
const weaponManager = new WeaponManager();

// Main App
const app = {
  currentPage: 'gacha-page',
  pages: ['gacha-page', 'character-collection-page', 'autobattler-page', 'weapon-management-page'],

  showPage: function (pageId) {
    if (this.pages.includes(pageId)) {
      document.getElementById(this.currentPage).style.display = 'none';
      document.getElementById(pageId).style.display = 'block';
      this.currentPage = pageId;

      if (pageId === 'character-collection-page') {
        characterCollection.renderCharacters();
      } else if (pageId === 'autobattler-page') {
        autobattler.renderAvailableCharacters();
      } else if (pageId === 'weapon-management-page') {
        weaponManagement.renderWeaponList();
        weaponManagement.setupAutoEnhance();
      }
    } else {
      console.error('Page not found:', pageId);
    }
  }
};

// Gacha System
// Refactored Gacha Code to Utilize Modal

// ===================================
// Global Instances
// ===================================
// Refactored Gacha Code to Utilize Modal with Build-Up Animation and Large Image Reveal

// ===================================
// Global Instances
// ===================================
// Refactored Gacha Code to Utilize Modal with Build-Up Animation and Near Full-Screen Reveal

// ===================================
// Global Instances
// ===================================
const gacha = {
  inventory: { characters: {}, weapons: {} },
  pityCounter: 0,
  softPityThreshold: 75,
  hardPityThreshold: 90,
  pulls: 0,
  randomGenerator: new ComplexRandomGenerator(1000),
  banners: [],
  currentBanner: null,
  items: {
    '5-star': {
      characters: ['Diluc', 'Jean', 'Qiqi', 'Keqing', 'Mona'],
      weapons: ['Wolf\'s Gravestone', 'Skyward Blade', 'Primordial Jade Winged-Spear', 'Amos\' Bow', 'Lost Prayer to the Sacred Winds']
    },
    '4-star': {
      characters: ['Barbara', 'Fischl', 'Noelle', 'Xiangling', 'Beidou', 'Xingqiu'],
      weapons: ['Rust', 'Sacrificial Sword', 'Dragon\'s Bane', 'Favonius Lance', 'The Widsith']
    },
    '3-star': {
      weapons: ['Cool Steel', 'Debate Club', 'Black Tassel', 'Slingshot', 'Thrilling Tales of Dragon Slayers']
    }
  },

  addBanner: function (banner) {
    this.banners.push(banner);
    if (!this.currentBanner) {
      this.currentBanner = banner;
    }
  },

  switchBanner: function (bannerName) {
    const banner = this.banners.find(b => b.name === bannerName && b.isActive());
    if (banner) {
      this.currentBanner = banner;
    }
  },
  
  pull: function (num = 1) {
    // Get pull costs from gameData
    const pullCost = num === 10 ? gameData.gacha.tenPullCost : gameData.gacha.singlePullCost;

    // Check resources before pulling
    if (!resourceManager.useResource('soulGems', pullCost)) {
      console.log("Not enough Soul Gems for pull.");
      return [];
    }
  
    let results = [];
    let isStoppedOnFiveStar = false;
  
    for (let i = 0; i < num; i++) {
      this.pulls++;
      const item = this.getRandomItem();
      results.push(item);
  
      // Check for skip logic
      if (skipActive && item.rarity === '5-star') {
        const character = characterManager.getOwnedCharacter(item.name);
        if (!character) { // Stop on unique 5-star
          console.log(`Unique 5★ pull: ${item.name}. Stopping skip.`);
          isStoppedOnFiveStar = true;
          skipActive = false; // Reset skip flag
          break;
        }
      }
  
      if (item.type === 'weapons') {
        this.addWeaponToManager(item);
      }
    }
  
    results.forEach(this.updateInventory.bind(this));
    openGachaModalWithFullScreenReveal(results);
    return results;
  },
  

  addWeaponToManager: function(weaponData) {
    console.log('Creating new weapon:', weaponData);
    const typeMapping = {
        'Wolf\'s Gravestone': 'Axe',
        'Skyward Blade': 'Sword',
        'Primordial Jade Winged-Spear': 'Polearm',
        'Amos\' Bow': 'Bow',
        'Lost Prayer to the Sacred Winds': 'Magic',
        'Rust': 'Bow',
        'Sacrificial Sword': 'Sword',
        'Dragon\'s Bane': 'Polearm',
        'Favonius Lance': 'Polearm',
        'The Widsith': 'Magic',
        'Cool Steel': 'Sword',
        'Debate Club': 'Axe',
        'Black Tassel': 'Polearm',
        'Slingshot': 'Bow',
        'Thrilling Tales of Dragon Slayers': 'Magic'
    };

    const weaponType = typeMapping[weaponData.name] || 'Sword';

    const newWeapon = new Weapon(
        weaponData.name,
        weaponData.rarity,
        {
            atk: Math.floor(Math.random() * 50) + 50,
            def: Math.floor(Math.random() * 30) + 30
        },
        weaponType
    );
    weaponManager.addWeapon(newWeapon);
  },

  getRandomItem: function () {
    this.pityCounter++;  // Tracks total pulls for 5-star pity
    this.fourStarPityCounter++; // Tracks pulls for 4-star pity
  
    const pityConfig5Star = gameData.gacha.pitySystem["5-star"];
    const pityConfig4Star = gameData.gacha.pitySystem["4-star"];
    const pullRates = gameData.gacha.pullRates;
  
    let randomNum = this.randomGenerator.getRandomNumber() / 1000;
  
    // --- 5-Star Logic ---
    if (this.pityCounter >= pityConfig5Star.hardPity) {
      this.pityCounter = 0; // Reset 5-star pity counter
      return this.getRandomFiveStar();
    }
    if (this.pityCounter >= pityConfig5Star.softPity.threshold) {
      randomNum *= (1 + (this.pityCounter - pityConfig5Star.softPity.threshold) * pityConfig5Star.softPity.multiplier);
    }
  
    // --- 4-Star Logic ---
    if (this.fourStarPityCounter >= pityConfig4Star.hardPity) {
      this.fourStarPityCounter = 0; // Reset 4-star pity counter
      return this.getRandomFourStar();
    }
  
    // --- Normal Drop Rates ---
    if (randomNum < pullRates["5-star"]) {
      this.pityCounter = 0; // Reset 5-star pity counter
      return this.getRandomFiveStar();
    } else if (randomNum < pullRates["4-star"]) {
      this.fourStarPityCounter = 0; // Reset 4-star pity counter
      return this.getRandomFourStar();
    } else {
      return this.getRandomThreeStar();
    }
  },

  
  getRandomFiveStar: function () {
    if (Math.random() < 0.5) {
      return { rarity: '5-star', type: 'characters', name: this.currentBanner.featured5Star };
    } else {
      const type = Math.random() < 0.5 ? 'characters' : 'weapons';
      const item = this.items['5-star'][type][Math.floor(Math.random() * this.items['5-star'][type].length)];
      return { rarity: '5-star', type, name: item };
    }
  },

  getRandomFourStar: function () {
    if (Math.random() < 0.5) {
      return { rarity: '4-star', type: 'characters', name: this.currentBanner.featured4Stars[Math.floor(Math.random() * this.currentBanner.featured4Stars.length)] };
    } else {
      const type = Math.random() < 0.5 ? 'characters' : 'weapons';
      const item = this.items['4-star'][type][Math.floor(Math.random() * this.items['4-star'][type].length)];
      return { rarity: '4-star', type, name: item };
    }
  },

  getRandomThreeStar: function () {
    return { rarity: '3-star', type: 'weapons', name: this.items['3-star'].weapons[Math.floor(Math.random() * this.items['3-star'].weapons.length)] };
  },

  updateInventory: function (item) {
    if (item.type === 'characters') {
      characterManager.addOwnedCharacter(item.name, item.rarity);
      characterCollection.renderCharacters();
    } else {
      if (!this.inventory[item.type][item.name]) {
        this.inventory[item.type][item.name] = { count: 0, rarity: item.rarity };
      }
      this.inventory[item.type][item.name].count++;
    }
  }
};

// Modal Functions
function openGachaModalWithFullScreenReveal(results) {
  const modal = document.getElementById('gacha-modal');
  const resultContainer = document.getElementById('gacha-results'); // Final results container
  const fullScreenContainer = document.createElement('div'); // Full-screen reveal container

  if (!modal || !resultContainer) {
    console.error('[DEBUG] Modal or result container not found!');
    return;
  }

  // Clear results and hide the final container
  resultContainer.style.display = 'none';
  resultContainer.innerHTML = '';

  // Setup the full-screen reveal container
  fullScreenContainer.className = 'full-screen-reveal';
  modal.appendChild(fullScreenContainer);
  modal.style.display = 'block';

  let index = 0;                 // Tracks the current reveal index
  let skipActive = false;        // Skip flag
  let timeoutID = null;          // To track and clear timeouts
  const sessionOwnedItems = new Set(); // Tracks new 5-stars during the session

  // Create Skip Button
  let skipButton = document.getElementById('skip-reveal-button');
  if (skipButton) skipButton.remove();

  skipButton = document.createElement('button');
  skipButton.textContent = 'Skip';
  skipButton.id = 'skip-reveal-button';
  skipButton.style.cssText = `
    position: absolute;
    top: 10%;
    right: 5%;
    padding: 10px 20px;
    background: #ff6347;
    color: white;
    border: none;
    font-size: 1.2em;
    border-radius: 5px;
    cursor: pointer;
    z-index: 10000;
  `;
  modal.appendChild(skipButton);

  skipButton.addEventListener('click', () => {
    console.log('[DEBUG] Skip button clicked.');
    clearTimeout(timeoutID); // Stop any ongoing timeout
    fastForwardToNextFiveStar();
  });

  function showNextItem() {
    if (index < results.length) {
      const result = results[index];
      const isFiveStar = result.rarity === '5-star';
      const isNew = !sessionOwnedItems.has(result.name);

      console.log(`[DEBUG] Showing item ${index}: ${result.name} (${result.rarity})`);

      fullScreenContainer.innerHTML = `
        <div class="full-screen-item ${result.rarity}">
          <img src="images/${result.type}/${result.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${result.name}">
          <p>${result.name}</p>
        </div>
      `;

      if (isFiveStar && isNew) {
        console.log(`[DEBUG] Paused on unique 5-star: ${result.name}`);
        sessionOwnedItems.add(result.name);
        return; // Pause on unique 5-star
      }

      timeoutID = setTimeout(() => {
        index++;
        showNextItem();
      }, 1500);
    } else {
      displayAllResults();
    }
  }

  function fastForwardToNextFiveStar() {
    console.log('[DEBUG] Fast forwarding...');
    while (index < results.length) {
      const result = results[index];
      const isFiveStar = result.rarity === '5-star';
      const isNew = !sessionOwnedItems.has(result.name);

      if (isFiveStar && isNew) {
        sessionOwnedItems.add(result.name);
        showNextItem();
        return;
      }
      index++;
    }
    displayAllResults();
  }

  function displayAllResults() {
    console.log('[DEBUG] Displaying final results...');

    // Clean up full-screen reveal
    fullScreenContainer.remove();
    if (skipButton) skipButton.remove();

    // Show final results container
    resultContainer.style.display = 'grid';
    resultContainer.innerHTML = '';

    results.forEach((result) => {
      const resultDiv = document.createElement('div');
          // Determine rarity class and stars
    const rarityClass = `rarity-${result.rarity.toLowerCase().replace(' ', '-')}`;
    const stars = '★'.repeat(getRarityNumber(result.rarity));

    resultDiv.className = `gacha-result ${rarityClass}`;
    resultDiv.innerHTML = `
      <div class="stars">${stars}</div>
      <img src="images/${result.type}/${result.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${result.name}">
      <p>${result.name}</p>
    `;
    resultContainer.appendChild(resultDiv);
    });

      // Helper function to get the numeric rarity value
    function getRarityNumber(rarity) {
      if (rarity.includes('5')) return 5;
      if (rarity.includes('4')) return 4;
      if (rarity.includes('3')) return 3;
      if (rarity.includes('2')) return 2;
      return 1; // Default for unknown rarities
    }
  }

  // Start the full-screen reveal
  showNextItem();
}

function closeGachaModal() {
  const modal = document.getElementById('gacha-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Attach event listeners for closing modal
window.addEventListener('click', (event) => {
  const modal = document.getElementById('gacha-modal');
  if (event.target === modal) {
    closeGachaModal();
  }
});

document.getElementById('close-modal').addEventListener('click', closeGachaModal);

// Character Collection
const characterCollection = {
  selectedCharacter: null,

  renderCharacters() {
    const characterList = document.querySelector('.character-list');
    if (!characterList) return;
    characterList.innerHTML = ''; // Clear existing character list
  
    // Render all owned characters
    for (const char of characterManager.getAllOwnedCharacters()) {
      const charElement = document.createElement('div');
      charElement.className = `character-card ${char.currentRarity}`;
      charElement.innerHTML = `
        <img src="images/characters/${char.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${char.name}">
        <h3>${char.name}</h3>
        <p>Level: ${char.level}/${char.getMaxLevel()}</p>
        <p>HP: ${Math.floor(char.hp)}/${Math.floor(char.maxHp)}</p>
        <p>ATK: ${char.currentStats.atk}</p>
        <p>DEF: ${char.currentStats.def}</p>
      `;
      charElement.addEventListener('click', () => this.selectCharacter(char));
      characterList.appendChild(charElement);
    }
  },
  

  selectCharacter: function (character) {
    this.selectedCharacter = character;
    this.updateCharacterDetails();
  },

  updateCharacterDetails() {
    const char = this.selectedCharacter;
  
    // Get the character details container
    const detailsContainer = document.getElementById('character-details-container');
  
    // Check if a character is selected
    if (!char) {
      console.error('[DEBUG] No character selected for update.');
      detailsContainer.style.display = 'none'; // Hide the container
      return;
    }
  
    // Show the container when a character is selected
    detailsContainer.style.display = 'flex';
  
    // Update Character Image
    const characterImage = document.getElementById('character-image');
    const imageName = char.name.toLowerCase().replace(/\s+/g, '_') + '.png';
    characterImage.src = `images/characters/${imageName}`;
    characterImage.alt = `${char.name} Art`;
    characterImage.onerror = () => {
      characterImage.src = 'images/characters/default.png';
      console.warn(`[DEBUG] Could not load image for ${char.name}. Using default image.`);
    };
  
    // Update Character Info
    document.getElementById('character-name').textContent = char.name;
    document.getElementById('character-rarity').querySelector('.rarity-text').textContent = `${char.currentRarity}`;
    document.getElementById('character-element').querySelector('.element-text').textContent = char.element;
    document.getElementById('character-class').querySelector('.class-text').textContent = char.assignedWeaponClass;
  
    // Update Stats
    document.getElementById('character-level').textContent = char.level;
    document.getElementById('character-max-level').textContent = char.getMaxLevel();
    document.getElementById('character-hp').textContent = Math.floor(char.hp);
    document.getElementById('character-max-hp').textContent = Math.floor(char.maxHp);
    document.getElementById('character-atk').textContent = Math.round(char.currentStats.atk);
    document.getElementById('character-def').textContent = Math.round(char.currentStats.def);
    document.getElementById('character-speed').textContent = Math.round(char.currentStats.speed);
    document.getElementById('character-crit-chance').textContent = Math.round(char.currentStats.critChance);
    document.getElementById('character-crit-damage').textContent = Math.round(char.currentStats.critDamage);
  
    // Update Weapon Info
    const weaponName = char.weapon ? char.weapon.name : 'None';
    document.getElementById('weapon-name').textContent = weaponName;
  
    // Update Abilities
    document.getElementById('character-skill-1').textContent = char.skill1 ? char.skill1.name : 'None';
    document.getElementById('character-skill-2').textContent = char.skill2 ? char.skill2.name : 'None';
    document.getElementById('character-passive').textContent = char.passive ? char.passive.name : 'None';
  
    const weaponSelector = this.renderWeaponSelector(char);
    const container = document.getElementById('weapon-selector');
    container.innerHTML = ''; // Clear existing options
    container.appendChild(weaponSelector);
  
    // Attach Level-Up Button
    const levelUpButton = document.getElementById('level-up-button');
    levelUpButton.onclick = () => {
      if (char.levelUp()) {
        this.updateCharacterDetails(); // Refresh details
        this.renderCharacters(); // Refresh character collection
      }
    };
  
    // Attach Awaken Button
    const awakenButton = document.getElementById('awaken-button');
    awakenButton.onclick = () => {
      if (char.awaken()) {
        this.updateCharacterDetails(); // Refresh details
        this.renderCharacters(); // Refresh character collection
      } else {
        console.log(`[DEBUG] Unable to awaken ${char.name}.`);
      }
    };
  },
  
  

renderWeaponSelector(character) {
  const selector = document.createElement('select');
  selector.appendChild(new Option('None', ''));

  const compatibleWeapons = weaponManager.filterWeaponsForCharacter(character);
  compatibleWeapons.forEach((weapon, index) => {
    const option = document.createElement('option');
    option.value = index;
    const currentStats = weapon.getCurrentStats();
    option.textContent = `${weapon.name} (Level ${weapon.level}, ATK: ${currentStats.atk})`;

    if (character.weapon === weapon) {
      option.selected = true;
    }
    selector.appendChild(option);
  });

  selector.addEventListener('change', (e) => {
    if (e.target.value === '') {
      character.unequipWeapon();
    } else {
      const selectedIndex = parseInt(e.target.value, 10);
      const selectedWeapon = compatibleWeapons[selectedIndex];
      character.equipWeapon(selectedWeapon);
    }
    this.updateCharacterDetails();
    this.renderCharacters(); // Refresh character details
  });

  return selector;
},



  levelUpCharacter: function () {
    if (this.selectedCharacter && this.selectedCharacter.levelUp(resourceManager)) {
      this.updateCharacterDetails();
    }
  },

  awakenCharacter: function () {
    if (this.selectedCharacter && this.selectedCharacter.awaken(resourceManager)) {
      this.updateCharacterDetails();
    }
  },

  init: function () {
    this.renderCharacters();
  }
};

// Autobattler
const autobattler = {
  team: [],
  enemies: [],
  currentStage: 1,
  isRunning: false,
  isChallenging: false, 
  resourceManager: new ResourceManager(),
  enemyFactory: new EnemyFactory(),

  initializePage() {
    document.getElementById('start-battle').addEventListener('click', () => this.toggleBattle());
    document.getElementById('challenge-stage').addEventListener('click', () => this.challengeStage());
    this.updateResourceDisplay();
    this.renderAvailableCharacters();
    this.updateStageDisplay();
  },

  renderAvailableCharacters() {
    const container = document.getElementById('available-characters');
    if (!container) {
      console.error("Container for available characters not found.");
      return;
    }

    const characters = characterManager.getAllOwnedCharacters();
    container.innerHTML = this.getCharacterHTML(characters);

    // Attach event listeners to the select buttons
    container.querySelectorAll('.select-btn').forEach((button, index) => {
      button.addEventListener('click', () => {
        const char = characters[index];
        console.log(`Button clicked for character: ${char.name}`);
        this.toggleCharacterSelection(char);
      });
    });
    console.log("Event listeners attached to character select buttons.");
  },

  toggleCharacterSelection(character) {
    const index = this.team.findIndex(c => c.name === character.name);
    index === -1 && this.team.length < 5 ? this.team.push(character) : this.team.splice(index, 1);
    this.updateTeamDisplay();
    this.renderAvailableCharacters();
    this.updateStartButtonState();
  },

  updateTeamDisplay() {
    const container = document.getElementById('team-members');
    if (container) {
      container.innerHTML = this.getCharacterHTML(this.team, this.toggleCharacterSelection.bind(this));
    }
  },

  updateStartButtonState() {
    const startButton = document.getElementById('start-battle');
    if (startButton) startButton.disabled = this.team.length === 0;
  },

  toggleBattle() {
    if (this.battleInProgress) {
      console.log("A battle is already in progress.");
      return;
    }

    this.isRunning ? this.stopBattle() : this.startBattle();
  },

  startBattle() {
    if (this.team.length > 0) {
      this.isRunning = true;
      document.getElementById('start-battle').textContent = 'Stop Farming';
      this.battleLoop();
    } else {
      console.log("Select at least one character.");
    }
  },

  stopBattle() {
    this.isRunning = false;
    document.getElementById('start-battle').textContent = 'Start Farming';
  },

  battleLoop() {
    if (!this.isRunning) return;

    const xpGained = this.team.reduce((sum, char) => sum + char.currentStats.atk, 0) * this.currentStage;
    const gemsGained = Math.floor(xpGained / 10) * this.currentStage;

    // Gaining resources during battle
    resourceManager.addResource('crystallizedXP', xpGained);
    resourceManager.addResource('soulGems', gemsGained);
    this.logBattleAction(`Stage ${this.currentStage}: Gained ${xpGained} XP and ${gemsGained} Gems!`);
    this.updateResourceDisplay();

    setTimeout(() => this.battleLoop(), 1000);
  },

  challengeStage() {
    if (this.isChallenging) {
      console.log("A stage challenge is already in progress.");
      return; // Prevent starting another challenge
    }

    this.isChallenging = true; // Lock stage challenge
    this.stopBattle(); // Ensure farming stops before challenging
    this.enemies = this.enemyFactory.generateEnemies(this.currentStage);
    this.renderBattleground();
    this.simulateBattle();
  },

  renderBattleground() {
    const alliesContainer = document.getElementById('allies');
    const enemiesContainer = document.getElementById('enemies');
    if (!alliesContainer || !enemiesContainer) return;

    alliesContainer.innerHTML = this.getTokenHTML(this.team, 'ally');
    enemiesContainer.innerHTML = this.getTokenHTML(this.enemies, 'enemy');
  },

  simulateBattle() {
    const allUnits = [...this.team, ...this.enemies]; // Combined turn pool
    let ongoing = true;
  
    const turnOrder = this.determineTurnOrder(allUnits);
  
    const battleInterval = setInterval(() => {
      if (!ongoing) {
        clearInterval(battleInterval);
        this.endBattle(this.enemies.every(enemy => enemy.hp <= 0)); // Victory if all enemies are defeated
        return;
      }
  
      for (const unit of turnOrder) {
        if (unit.hp <= 0) continue; // Skip defeated units
  
        // Determine valid targets
        const targets = unit.isAlly ? this.enemies.filter(enemy => enemy.hp > 0) : this.team.filter(ally => ally.hp > 0);
        const target = this.selectTarget(targets);
  
        if (!target) {
          // If no valid targets remain, end the battle
          ongoing = false;
          break;
        }
  
        // Recharge energy for this unit
        unit.energy = Math.min(100, unit.energy + unit.currentStats.energyRecharge * 10);
  
        // Use skill if energy is full, otherwise perform a normal attack
        let damage, actionType;
        if (unit.energy >= 100) {
          const skill = this.selectSkill(unit);
          damage = this.calculateDamage(unit, target, skill.damage);
          actionType = `uses ${skill.name}`;
          unit.energy = 0; // Reset energy after skill usage
        } else {
          damage = this.calculateDamage(unit, target, unit.currentStats.atk);
          actionType = "performs a normal attack";
        }
  
        // Apply damage to the target
        target.hp = Math.max(0, Math.floor(target.hp - damage) || 0);
        
        // Log the action
        this.logBattleAction(
          `${unit.name} ${actionType} on ${target.name}, dealing ${Math.floor(damage)} damage.`
        );
  
        if (target.hp <= 0) {
          this.logBattleAction(`${target.name} has been defeated.`);
        }
  
        // Check for end of battle
        if (this.team.every(ally => ally.hp <= 0) || this.enemies.every(enemy => enemy.hp <= 0)) {
          ongoing = false;
          break;
        }
      }
  
      // Update the battleground after each turn
      this.renderBattleground();
    }, 1000);
  },

  determineTurnOrder(units) {
    console.log([...units].sort((a, b) => b.currentStats.speed - a.currentStats.speed));
    return [...units].sort((a, b) => b.currentStats.speed - a.currentStats.speed);
  },

  calculateDamage(attacker, target, baseDamage) {
    let damage = baseDamage * (1 - target.currentStats.def / 1000);
  
    // Apply elemental advantage multiplier
    if (attacker.element === elementalWheel.getWeakness(target.element)) {
      damage *= 1.5;
    }
  
    // Determine if the attack is a critical hit
    const isCritical = Math.random() * 100 < attacker.currentStats.critChance;
    if (isCritical) {
      damage *= attacker.currentStats.critDamage;
      this.logBattleAction(`${attacker.name} lands a CRITICAL HIT!`);
    }
  
    return damage;
  },
  

  selectTarget(targets) {
    const validTargets = targets.filter(target => target.hp > 0); // Only select alive targets
    return validTargets.length > 0 ? validTargets[Math.floor(Math.random() * validTargets.length)] : null;
  },

  selectSkill(unit) {
    // Check if the unit has valid skills
    const availableSkills = [];
    if (unit.skill1) availableSkills.push(unit.skill1);
    if (unit.skill2) availableSkills.push(unit.skill2);
  
    // Select a random skill if available
    if (availableSkills.length > 0) {
      return availableSkills[Math.floor(Math.random() * availableSkills.length)];
    }
  
    // Default fallback: return a basic attack if no skills are set
    return {
      name: "Basic Attack",
      damage: unit.currentStats.atk
    };
  }, 

  endBattle(victory) {
    if (victory) {
      this.logBattleAction(`Victory! Advanced to Stage ${++this.currentStage}`);
    } else {
      this.logBattleAction(`Defeat. Remaining at Stage ${this.currentStage}`);
    }
    this.resetAllCharacters(); // Reset characters for future battles
    this.updateStageDisplay();
    this.isChallenging = false; // Unlock stage challenge
  },

  updateResourceDisplay() {
    document.getElementById('resource-xp').textContent = resourceManager.getResourceAmount('crystallizedXP');
    document.getElementById('resource-gems').textContent = resourceManager.getResourceAmount('soulGems');
  },
  

  updateStageDisplay() {
    const stage = document.getElementById('current-stage');
    if (stage) stage.textContent = `Current Stage: ${this.currentStage}`;
  },

  logBattleAction(message) {
    const log = document.getElementById('battle-log');
    if (log) {
      log.innerHTML += `<p>${message}</p>`;
      log.scrollTop = log.scrollHeight;
    }
  },

  resetAllCharacters() {
    this.team.forEach(unit => {
      unit.hp = Math.max(unit.hp, unit.maxHp); // Retain current HP if above 0
      unit.energy = 0; // Reset energy for all characters
    });
    this.enemies = []; // Clear enemy list after battle
  },

  getCharacterHTML(characters, isRemove = false) {
    return characters.map(char => `
      <div class="character-card">
        <img src="images/characters/${char.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${char.name}">
        <h4>${char.name}</h4>
        <p>Level: ${char.level}</p>
        <p>HP: ${char.hp}</p>
        <p>ATK: ${char.currentStats.atk}</p>
        <button class="${isRemove ? 'remove-btn' : 'select-btn'}">
          ${isRemove ? 'Remove' : (this.team.includes(char) ? 'Remove' : 'Select')}
        </button>
      </div>
    `).join('');
  },

  getTokenHTML(units, className) {
    return units.map(unit => `
      <div class="character-token ${className}" 
           data-name="${unit.name}">
           <div class="token-ui">
  <div class="token-hp-bar" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div>
  <div class="token-energy-bar" style="width: ${Math.min(unit.energy, 100)}%"></div>
      </div>
        <img class="character-image ${unit.hp > 0 ? 'alive' : 'dead'}"
             src="images/characters/${unit.name.toLowerCase().replace(/\s+/g, '_')}.png" 
             alt="${unit.name}" 
             onerror="this.src='images/characters/default.png'">
        <div class="token-info">
          <p>${unit.name}</p>
          <p>HP: ${Math.floor(unit.hp)}/${Math.floor(unit.maxHp)}</p>
          <p>Energy: ${Math.floor(unit.energy)}%</p>
        </div>
      </div>
    `).join('');
  },
  
  renderBattleUI() {
    const allyStats = document.getElementById('ally-stats');
    const enemyStats = document.getElementById('enemy-stats');
    if (allyStats && enemyStats) {
      allyStats.innerHTML = this.getUnitStatsHTML(this.team);
      enemyStats.innerHTML = this.getUnitStatsHTML(this.enemies);
    }
  },

  updateTokenUI(unit, className) {
    // Find the token for the given unit
    const token = document.querySelector(`.character-token.${className}[data-name="${unit.name}"]`);
    if (!token) return; // If the token isn't found, skip
  
    // Update HP bar
    const hpBar = token.querySelector('.token-hp-bar');
    if (hpBar) {
      hpBar.style.width = `${(unit.hp / unit.maxHp) * 100}%`;
    }
  
    // Update Energy bar
    const energyBar = token.querySelector('.token-energy-bar');
    if (energyBar) {
      energyBar.style.width = `${Math.min(unit.energy, 100)}%`;
    }
  
    // Update text for HP and Energy
    const tokenInfo = token.querySelector('.token-info');
    if (tokenInfo) {
      tokenInfo.querySelector('p:nth-child(2)').textContent = `HP: ${Math.floor(unit.hp)}/${Math.floor(unit.maxHp)}`;
      tokenInfo.querySelector('p:nth-child(3)').textContent = `Energy: ${Math.floor(unit.energy)}%`;
    }
  
    // Handle alive vs dead state for the image
    const image = token.querySelector('.character-image');
    if (image) {
      if (unit.hp > 0) {
        image.classList.add('alive');
        image.classList.remove('dead');
      } else {
        image.classList.add('dead');
        image.classList.remove('alive');
      }
    }
  },

  getUnitStatsHTML(units) {
    return units.map(unit => `
      <div class="unit-stats">
        <div>${unit.name}</div>
        <div>HP: <span class="hp-value">${unit.hp}</span>/${unit.maxHp}</div>
        <div class="hp-bar" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div>
        <div>Energy: ${unit.energy}%</div>
      </div>
    `).join('');
  },

  updateBattleUI() {
    [...this.team, ...this.enemies].forEach(unit => {
      const token = document.querySelector(`.character-token[data-name="${unit.name}"]`);
      if (token) {
        const hpBar = token.querySelector('.token-hp-bar');
        const energyBar = token.querySelector('.token-energy-bar');
        if (hpBar) hpBar.style.width = `${(unit.hp / unit.maxHp) * 100}%`;
        if (energyBar) energyBar.style.width = `${unit.energy}%`;
      }
    });
  }
};


// Weapon Management
const weaponManagement = {
  selectedWeapon: null,
  sortField: 'name',
  sortAscending: true,
  
  initializeSortControls() {
    const sortFieldSelect = document.getElementById('weapon-sort-select');
    const sortOrderButton = document.getElementById('sort-order-btn');
  
    // Handle field change
    sortFieldSelect.addEventListener('change', (e) => {
      this.sortField = e.target.value; // Update sort field
      console.log(`[DEBUG] Sort field changed to: ${this.sortField}`);
      this.renderWeaponList(); // Re-render the list
    });
  
    // Handle order toggle
    sortOrderButton.addEventListener('click', () => {
      this.sortAscending = !this.sortAscending; // Toggle sort order
      sortOrderButton.textContent = this.sortAscending ? '↑' : '↓'; // Update button text
      console.log(`[DEBUG] Sort order toggled to: ${this.sortAscending ? 'Ascending' : 'Descending'}`);
      this.renderWeaponList(); // Re-render the list
    });
  },

  init() {
    this.renderWeaponList();
    this.initializeSortControls();
  },

  renderWeaponList() {
    const weaponList = document.getElementById('weapon-list');
    if (!weaponList) {
      console.error('[DEBUG] Weapon list container not found.');
      return;
    }
  
    // Clear existing weapon list
    weaponList.innerHTML = '';
  
    // Sort weapons based on the selected field and order
    const sortedWeapons = [...weaponManager.weapons].sort((a, b) => {
      let fieldA, fieldB;
  
      // Use getCurrentStats for ATK comparison
      if (this.sortField === 'atk') {
        fieldA = a.getCurrentStats().atk;
        fieldB = b.getCurrentStats().atk;
      } else {
        fieldA = a[this.sortField];
        fieldB = b[this.sortField];
      }
  
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return this.sortAscending
          ? fieldA.localeCompare(fieldB)
          : fieldB.localeCompare(fieldA);
      }
  
      if (typeof fieldA === 'number' && typeof fieldB === 'number') {
        return this.sortAscending ? fieldA - fieldB : fieldB - fieldA;
      }
  
      return 0; // Default case for non-sortable fields
    });
  
    console.log(`[DEBUG] Weapons sorted by: ${this.sortField}, Order: ${this.sortAscending ? 'Ascending' : 'Descending'}`);
  
    // Render sorted weapons
    sortedWeapons.forEach(weapon => {
      const weaponCard = document.createElement('div');
      weaponCard.className = `weapon-card ${weapon === this.selectedWeapon ? 'selected' : ''}`;
  
      const currentStats = weapon.getCurrentStats();
      weaponCard.innerHTML = `
        <img src="images/weapons/${weapon.name.toLowerCase().replace(/\s+/g, '_')}.png" 
             alt="${weapon.name}" 
             onerror="this.src='images/weapons/WP_default.png'">
        <div class="weapon-info">
          <h3>${weapon.name}</h3>
          <p class="weapon-type ${weapon.type.toLowerCase()}">${weapon.type}</p>
          <p>Level ${weapon.level}/${weapon.maxLevel}</p>
          <p>ATK: ${currentStats.atk}</p>
          ${weapon.equippedBy ? `<p>Equipped by: ${weapon.equippedBy.name}</p>` : ''}
        </div>
      `;
  
      // Add click event to select the weapon
      weaponCard.addEventListener('click', () => this.selectWeapon(weapon));
  
      weaponList.appendChild(weaponCard);
    });
  },

  getSortedWeapons() {
    return [...weaponManager.weapons].sort((a, b) => {
      let comparison = 0;
      if (a[this.sortField] < b[this.sortField]) comparison = -1;
      if (a[this.sortField] > b[this.sortField]) comparison = 1;
      return this.sortAscending ? comparison : -comparison;
    });
  },

  selectWeapon: function (weapon) {
    console.log('Selecting weapon:', weapon);
    this.selectedWeapon = weapon;
    this.renderWeaponList(); // Re-render to update selection highlighting
    this.renderWeaponDetails(); // Call the existing details render method
  },

  populateSacrificeWeapons: function () {
    const sacrificeSelect = document.getElementById('sacrifice-weapon-select');
    if (!sacrificeSelect) {
      console.log('Sacrifice select element not found');
      return;
    }

    // Clear existing options
    sacrificeSelect.innerHTML = '<option value="">Select weapon to sacrifice</option>';

    // Get all weapons except the selected one
    weaponManager.weapons.forEach((weapon, index) => {
      // Skip if weapon is the selected weapon, is equipped, or is locked
      if (weapon === this.selectedWeapon ||
        weapon.equippedBy ||
        weapon.locked) {
        return;
      }

      const option = document.createElement('option');
      option.value = index;

      // Create detailed weapon description
      const currentStats = weapon.getCurrentStats();
      option.textContent = `${weapon.name} (Level ${weapon.level}, ${weapon.rarity}, ATK: ${currentStats.atk})`;

      sacrificeSelect.appendChild(option);
    });

    // Add change event listener
    sacrificeSelect.addEventListener('change', (e) => {
      const selectedIndex = parseInt(e.target.value);
      if (!isNaN(selectedIndex)) {
        const sacrificeWeapon = weaponManager.weapons[selectedIndex];
        console.log('Selected sacrifice weapon:', sacrificeWeapon);
      }
    });
  },

  attachDetailButtonListeners: function () {
    const enhanceBtn = document.getElementById('enhance-btn');
    const awakenBtn = document.getElementById('awaken-btn');
    const sacrificeSelect = document.getElementById('sacrifice-weapon-select');

    if (enhanceBtn && sacrificeSelect) {
      enhanceBtn.addEventListener('click', () => {
        console.log('Enhance button clicked');
        const sacrificeIndex = parseInt(sacrificeSelect.value);

        if (!isNaN(sacrificeIndex)) {
          const sacrificeWeapon = weaponManager.weapons[sacrificeIndex];
          console.log('Selected sacrifice weapon:', sacrificeWeapon);

          if (weaponManager.enhanceWeapon(this.selectedWeapon, sacrificeWeapon)) {
            console.log('Enhancement successful');
            this.renderWeaponList();
            this.renderWeaponDetails();

                    // Refresh character collection UI
        if (this.selectedWeapon.equippedBy) {
          characterCollection.updateCharacterDetails();
          console.log('[DEBUG] Character collection updated after weapon enhancement.');
        }
          }
        }
      });
    }

    if (awakenBtn) {
      awakenBtn.addEventListener('click', () => {
        console.log('Awaken button clicked');
        if (this.selectedWeapon && !this.selectedWeapon.awakened &&
          resourceManager.useResource('soulGems', 500)) {
          console.log('Awakening weapon:', this.selectedWeapon.name);
          weaponManager.awakenWeapon(this.selectedWeapon);
          this.renderWeaponList();
          this.renderWeaponDetails();
        }
      });
    }

    // Populate sacrifice weapon select
    if (sacrificeSelect) {
      sacrificeSelect.innerHTML = '<option value="">Select weapon to sacrifice</option>';
      weaponManager.weapons.forEach((weapon, index) => {
        if (weapon !== this.selectedWeapon && !weapon.equippedBy && !weapon.locked) {
          const option = document.createElement('option');
          option.value = index;
          option.textContent = `${weapon.name} (Level ${weapon.level}, ${weapon.rarity})`;
          sacrificeSelect.appendChild(option);
        }
      });
    }
  },

  renderWeaponDetails() {
    const detailsContainer = document.getElementById('weapon-details');
    if (!this.selectedWeapon) {
      detailsContainer.innerHTML = '<p>Select a weapon to view details</p>';
      return;
    }
  
    const weapon = this.selectedWeapon;
    const currentStats = weapon.getCurrentStats();
    const statRanges = weapon.getStatRanges();
  
    detailsContainer.innerHTML = `
      <div class="weapon-detail-header">
        <img src="images/weapons/${weapon.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${weapon.name}" onerror="this.src='images/weapons/WP_default.png'" class="weapon-detail-image">
        <div class="weapon-detail-title">
          <h3>${weapon.name}</h3>
          <p class="rarity-${weapon.rarity}">${weapon.rarity}</p>
        </div>
      </div>
      <div class="weapon-detail-stats">
        <p class="weapon-type ${weapon.type.toLowerCase()}">${weapon.type}</p>
        <p>Level: ${weapon.level}/${weapon.maxLevel}</p>
        <p>Enhancement XP: ${weapon.enhancementXP}/${weapon.xpToNextLevel}</p>
        <p>ATK: ${currentStats.atk} (Range: ${statRanges.atk[0]} - ${statRanges.atk[1]})</p>
        <p>DEF: ${currentStats.def} (Range: ${statRanges.def[0]} - ${statRanges.def[1]})</p>
        <p>Awakened: ${weapon.awakened ? 'Yes' : 'No'}</p>
        ${weapon.equippedBy ? `<p>Equipped by: ${weapon.equippedBy.name}</p>` : ''}
      </div>
      <div class="weapon-enhancement">
        <select id="sacrifice-weapon-select">
          <option value="">Select weapon to sacrifice</option>
        </select>
        <button id="enhance-btn">Enhance</button>
        <button id="awaken-btn" ${weapon.awakened ? 'disabled' : ''}>Awaken</button>
        <button id="auto-enhance-btn">Auto Enhance</button>
      </div>
    `;
  
    this.populateSacrificeWeapons();
    this.attachDetailButtonListeners();
  },
  

  setupAutoEnhance: function () {
    // Create the modal if it doesn't exist
    const modal = document.getElementById('auto-enhance-modal');
    const btn = document.getElementById('auto-enhance-btn');

    if (!modal || !btn) {
      console.log('Auto enhance elements not found');
      return;
    }

    btn.addEventListener('click', () => {
      console.log('Opening auto-enhance modal');
      modal.classList.add('show');
    });

    modal.querySelector('.close').addEventListener('click', () => {
      console.log('Closing auto-enhance modal');
      modal.classList.remove('show');
    });

    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        console.log('Closing modal via outside click');
        modal.classList.remove('show');
      }
    });

    this.setupAutoEnhanceFilters(modal);
  },

  setupAutoEnhanceFilters: function () {
    const modal = document.getElementById('auto-enhance-modal');
    if (!modal) {
      console.log('Modal not found for filters');
      return;
    }

    const filters = {
      rarity: new Set(),
      maxLevel: 1,
      excludeEquipped: true,
      excludeLocked: true
    };

    modal.querySelectorAll('[data-rarity]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          filters.rarity.add(e.target.dataset.rarity);
        } else {
          filters.rarity.delete(e.target.dataset.rarity);
        }
      });
    });

    const applyBtn = modal.querySelector('#apply-auto-enhance');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.executeAutoEnhance(filters);
        modal.classList.add('hidden');
      });
    }
  },

  executeAutoEnhance: function (filters) {
    if (!this.selectedWeapon) {
      console.log('No target weapon selected');
      return;
    }

    const materials = weaponManager.weapons.filter(weapon =>
      weapon !== this.selectedWeapon &&
      filters.rarity.has(weapon.rarity) &&
      weapon.level <= filters.maxLevel &&
      (!filters.excludeEquipped || !weapon.equippedBy) &&
      (!filters.excludeLocked || !weapon.locked)
    );

    console.log(`Found ${materials.length} weapons to use as materials`);
    materials.forEach(material => {
      this.selectedWeapon.addEnhancementXP(material);
      const index = weaponManager.weapons.indexOf(material);
      if (index > -1) {
        weaponManager.weapons.splice(index, 1);
      }
    });

    this.renderWeaponList();
    this.renderWeaponDetails();
  }
};

function updateBannerInfo() {
  const bannerTitle = document.getElementById('banner-title');
  const bannerArt = document.getElementById('banner-art');
  const featuredItems = document.getElementById('featured-items');
  const bannerTimer = document.getElementById('timer');

  
  if (!gacha.currentBanner) {
    console.warn('[DEBUG] No active banner found.');
    return;
  }

  // Check for null elements
  if (!bannerTitle || !bannerArt || !featuredItems || !bannerTimer) {
    console.error('[DEBUG] One or more banner info elements not found in DOM.');
    return;
  }

  // Update elements with current banner info
  bannerTitle.textContent = gacha.currentBanner.name;
  bannerArt.style.backgroundImage = `url('images/banners/${gacha.currentBanner.name.toLowerCase().replace(/\s+/g, '_')}.jpg')`;
  featuredItems.textContent = `Featured 5★: ${gacha.currentBanner.featured5Star}, 4★: ${gacha.currentBanner.featured4Stars.join(', ')}`;

  // Timer logic
  const now = Date.now();
  const endTime = gacha.currentBanner.startTime + gacha.currentBanner.duration;

  if (now > endTime) {
    bannerTimer.textContent = "Expired";
    console.warn('[DEBUG] Current banner has expired.');
  } else {
    const remainingTime = endTime - now;
    const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);
    const seconds = Math.floor((remainingTime / 1000) % 60);
    bannerTimer.textContent = `${hours}h ${minutes}m ${seconds}s`;
  }
}

// Upcoming Banners
function renderBanners() {
  const availableContainer = document.getElementById('available-banners-list');
  const upcomingContainer = document.getElementById('upcoming-banners-list');

  availableContainer.innerHTML = '';
  upcomingContainer.innerHTML = '';

  const now = Date.now();

  // Render Available Banners
  gacha.banners.forEach(banner => {
    if (banner.isActive()) {
      const timeRemaining = calculateTimeRemaining(banner);
      const bannerDiv = document.createElement('div');
      bannerDiv.className = 'banner-item';
      bannerDiv.style.backgroundImage = `url('images/banners/${banner.name.toLowerCase().replace(/\s+/g, '_')}.jpg')`;

      bannerDiv.innerHTML = `
        <p>${banner.name}</p>
        <p>Featured 5★: ${banner.featured5Star}</p>
        <p>${timeRemaining}</p>
      `;

      bannerDiv.addEventListener('click', () => {
        switchBanner(banner);
      });

      availableContainer.appendChild(bannerDiv);
    }
  });

  // Render Upcoming Banners (limit to 3)
  const upcomingBanners = gacha.banners
    .filter(banner => banner.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 3);

  upcomingBanners.forEach(banner => {
    const bannerDiv = document.createElement('div');
    bannerDiv.className = 'banner-item';
    bannerDiv.style.backgroundImage = `url('images/banners/${banner.name.toLowerCase().replace(/\s+/g, '_')}.jpg')`;

    const startDate = new Date(banner.startTime).toLocaleDateString();
    bannerDiv.innerHTML = `
      <p>${banner.name}</p>
      <p>Starts: ${startDate}</p>
    `;

    upcomingContainer.appendChild(bannerDiv);
  });

  // Fallback messages
  if (!availableContainer.children.length) {
    availableContainer.innerHTML = `<p>No available banners.</p>`;
  }

  if (!upcomingContainer.children.length) {
    upcomingContainer.innerHTML = `<p>No upcoming banners.</p>`;
  }
}

function calculateTimeRemaining(banner) {
  if (!banner.duration || banner.duration === Infinity) {
    return 'Infinite time remaining';
  }
  const now = Date.now();
  const endTime = banner.startTime + banner.duration;
  const remainingTime = endTime - now;

  if (remainingTime <= 0) return 'Expired';

  const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
  return days > 0 ? `${days} day(s) remaining` : 'Less than a day remaining';
}

function switchBanner(banner) {
  const bannerTitle = document.getElementById('banner-title');
  const bannerImage = document.getElementById('gacha-banner-image');
  const featured5Star = document.getElementById('featured-5-star');
  const bannerTimeRemaining = document.getElementById('banner-time-remaining');

  gacha.currentBanner = banner;

  // Set the banner image
  const imagePath = `images/banners/${banner.name.toLowerCase().replace(/\s+/g, '_')}.jpg`;
  bannerImage.style.backgroundImage = `url('${imagePath}')`;

  // Update banner details
  bannerTitle.textContent = banner.name;
  featured5Star.textContent = `Featured 5★: ${banner.featured5Star}`;

  // Stop any existing countdown
  if (countdownInterval) clearInterval(countdownInterval);

  // Start a new countdown
  function updateCountdown() {
    const now = Date.now();
    const endTime = banner.startTime + banner.duration;

    if (!banner.duration || banner.duration === Infinity) {
      bannerTimeRemaining.textContent = 'Infinite time remaining';
      return;
    }

    const remainingTime = endTime - now;

    if (remainingTime <= 0) {
      bannerTimeRemaining.textContent = 'Expired';
      clearInterval(countdownInterval);
      return;
    }

    const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);
    const seconds = Math.floor((remainingTime / 1000) % 60);

    bannerTimeRemaining.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
  }

  updateCountdown(); // Initial call
  countdownInterval = setInterval(updateCountdown, 1000); // Update every second
}

function getUpcomingBanners() {
  const now = Date.now();
  console.log('[DEBUG] Current time:', now);
  console.log('[DEBUG] Banners:', gacha.banners);

  const upcomingBanners = gacha.banners.filter(banner => banner.startTime > now);
  console.log('[DEBUG] Upcoming banners:', upcomingBanners);

  return upcomingBanners;
}



// ===================================
// Utility and Initialization Functions
// ===================================

function roundToTwoDecimals(value) {
  return parseFloat(value.toFixed(2));
}

function getNestedProperty(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function updateInventoryDisplay() {
  const charactersList = document.getElementById('characters-list');
  const weaponsList = document.getElementById('weapons-list');
  if (!charactersList || !weaponsList) return;

  charactersList.innerHTML = '';
  weaponsList.innerHTML = '';

  // Display characters
  for (const char of characterManager.getAllOwnedCharacters()) {
    const itemElement = document.createElement('div');
    itemElement.className = `inventory-item star-${char.currentRarity.split('-')[0]}`;
    itemElement.innerHTML = `
          <img src="images/characters/${char.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${char.name}">
          ${char.name} (${char.currentRarity}) - Level: ${char.level}
      `;
    itemElement.addEventListener('click', () => openModal('characters', char));
    charactersList.appendChild(itemElement);
  }

  // Display weapons
  for (const [name, data] of Object.entries(gacha.inventory.weapons)) {
    const itemElement = document.createElement('div');
    itemElement.className = `inventory-item star-${data.rarity.split('-')[0]}`;
    itemElement.innerHTML = `
          <img src="images/weapons/${name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${name}">
          ${name} (${data.rarity}) - Count: ${data.count}
      `;
    itemElement.addEventListener('click', () => openModal('weapons', name, data.rarity, data.count));
    weaponsList.appendChild(itemElement);
  }
}

function openModal(type, item, rarity, count) {
  const modal = document.getElementById('item-modal');
  const modalImage = document.getElementById('modal-image');
  const modalName = document.getElementById('modal-name');
  const modalRarity = document.getElementById('modal-rarity');
  const modalCount = document.getElementById('modal-count');

  if (type === 'characters') {
    modalImage.src = `images/characters/${item.name.toLowerCase().replace(/\s+/g, '_')}.png`;
    modalImage.alt = item.name;
    modalName.textContent = item.name;
    modalRarity.textContent = `Rarity: ${item.currentRarity}`;
    modalCount.textContent = `Level: ${item.level} | Awakening: ${item.awakening}/5 | Duplicates: ${item.duplicates}`;
  } else {
    modalImage.src = `images/weapons/${item.toLowerCase().replace(/\s+/g, '_')}.png`;
    modalImage.alt = item;
    modalName.textContent = item;
    modalRarity.textContent = `Rarity: ${rarity}`;
    modalCount.textContent = `Count: ${count}`;
  }

  modal.style.display = 'block';
}

document.getElementById('item-modal').addEventListener('click', function () {
  this.style.display = 'none';
});

function createBannerButtons() {
  const bannerContainer = document.getElementById('banner-container');
  if (!bannerContainer) return;
  bannerContainer.innerHTML = '';
  gacha.banners.forEach(banner => {
    const button = document.createElement('button');
    button.textContent = banner.name;
    button.addEventListener('click', () => {
      gacha.switchBanner(banner.name);
      updateBannerInfo();
      highlightSelectedBanner(button);
    });
    bannerContainer.appendChild(button);
  });
  if (gacha.currentBanner) {
    const currentButton = Array.from(bannerContainer.children).find(btn => btn.textContent === gacha.currentBanner.name);
    if (currentButton) highlightSelectedBanner(currentButton);
  }
}

function highlightSelectedBanner(selectedButton) {
  const buttons = document.querySelectorAll('#banner-container button');
  buttons.forEach(button => {
    button.style.backgroundColor = '#4CAF50';
  });
  selectedButton.style.backgroundColor = '#45a049';
}

function initializeBannerScroll() {
  const scrollContainer = document.getElementById('banner-scroll-container');
  const scrollLeftBtn = document.getElementById('scroll-left');
  const scrollRightBtn = document.getElementById('scroll-right');

  if (!scrollContainer || !scrollLeftBtn || !scrollRightBtn) return;

  scrollLeftBtn.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
  });

  scrollRightBtn.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
  });

  scrollContainer.addEventListener('scroll', () => {
    scrollLeftBtn.style.display = scrollContainer.scrollLeft > 0 ? 'block' : 'none';
    scrollRightBtn.style.display =
      scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth ? 'block' : 'none';
  });

  setTimeout(() => {
    scrollLeftBtn.style.display = 'none';
    scrollRightBtn.style.display =
      scrollContainer.scrollWidth > scrollContainer.clientWidth ? 'block' : 'none';
  }, 0);
}

function updateBannerArea() {
  const bannerArea = document.getElementById('banner-area');
  const bannerImage = document.getElementById('banner-image');
  const bannerTitle = document.getElementById('banner-title');
  const featuredItems = document.getElementById('featured-items');
  const featured4Stars = document.getElementById('featured-4-stars');

  if (!gacha.currentBanner) {
    console.error('[DEBUG] No current banner set.');
    return;
  }

  const banner = gacha.currentBanner;
  bannerImage.style.backgroundImage = `url('images/banners/${banner.name.toLowerCase().replace(/\s+/g, '_')}.jpg')`;
  bannerTitle.textContent = banner.name;
  featuredItems.textContent = `Featured 5★: ${banner.featured5Star}`;
  featured4Stars.textContent = `Featured 4★: ${banner.featured4Stars.join(', ')}`;
}

// Attach pull button functionality to the banner
document.getElementById('pull-single-button').addEventListener('click', () => {
  gacha.pull(1);
});

document.getElementById('pull-ten-button').addEventListener('click', () => {
  gacha.pull(10);
});

// Initialize banner area
document.addEventListener('DOMContentLoaded', () => {
  updateBannerArea();
});


function defineAbilities(characterManager) {
  const abilities = [
    {
      name: "Fireball",
      description: "Deals fire damage to a single enemy",
      effect: (caster, targets) => {
        const target = targets.find(t => !t.isAlly);
        if (!target) return { abilityName: "Fireball", damage: 0, description: "No enemy to target" };
        const damage = caster.atk * 1.5;
        target.hp -= damage;
        return { abilityName: "Fireball", damage, description: `Dealt ${damage} fire damage to ${target.name}` };
      },
      cooldown: 3
    },
    {
      name: "Heal",
      description: "Restores HP to the lowest health ally",
      effect: (caster, targets) => {
        const allies = targets.filter(char => char.isAlly);
        if (allies.length === 0) return { abilityName: "Heal", damage: 0, description: "No allies to heal" };
        const lowestHpAlly = allies.reduce((min, ally) => ally.hp < min.hp ? ally : min);
        const healAmount = caster.atk * 0.7;
        lowestHpAlly.hp += healAmount;
        return { abilityName: "Heal", damage: 0, description: `Healed ${lowestHpAlly.name} for ${healAmount} HP` };
      },
      cooldown: 4
    },
    {
      name: "FireResistance",
      description: "Passive: Increases fire resistance",
      effect: (caster) => {
        caster.fireResistance = (caster.fireResistance || 0) + 20;
        return { abilityName: "FireResistance", description: "Fire resistance increased by 20%" };
      },
      cooldown: 0
    }
  ];

  abilities.forEach(abilityData => {
    const ability = new Ability(abilityData.name, abilityData.description, abilityData.effect, abilityData.cooldown);
    characterManager.defineAbility(abilityData.name, ability);
  });
}

function defineCharactersFromData() {
  if (!gameData.characters) return;

  gameData.characters.forEach(characterData => {
    characterManager.defineCharacter(
      characterData.name,
      characterData.baseRarity,
      characterData.element,
      characterData.skills[0],
      characterData.skills[1],
      characterData.skills[2],
      characterData.weaponClass
    );
  });

  console.log('[DEBUG] Characters initialized from game data.');
}

function initializeBannersFromData() {
  if (!gameData.banners) return;

  gameData.banners.forEach(bannerData => {
    const startTime = bannerData.startTime === "Infinity" 
      ? Infinity 
      : new Date(bannerData.startTime).getTime();

    const banner = new Banner(
      bannerData.name,
      bannerData.featured5Star,
      bannerData.featured4Stars,
      bannerData.duration,
      startTime
    );

    gacha.addBanner(banner);
  });

  console.log('[DEBUG] Banners initialized from game data.');
}


function displayResults(results) {
  const resultContainer = document.getElementById('result');
  if (!resultContainer) return;

  resultContainer.innerHTML = '<div class="row"></div><div class="row"></div>';
  const rows = resultContainer.getElementsByClassName('row');

  if (!Array.isArray(results) || results.length === 0) {
      console.log("No results to display");
      resultContainer.innerHTML = '<p>No results to display.</p>';
      isAnimating = false;
      return;
  }

  results.forEach((result, index) => {
      setTimeout(() => {
          const cardDiv = document.createElement('div');
          cardDiv.className = `card ${result.rarity}`;
          cardDiv.innerHTML = `
              <img src="images/${result.type}/${result.name.toLowerCase().replace(/\s+/g, '_')}.png" alt="${result.name}">
              <p>${result.name}</p>
          `;

          rows[Math.floor(index / 5)].appendChild(cardDiv);

          // Apply shake animation to all cards
          cardDiv.classList.add('shake');
          setTimeout(() => cardDiv.classList.remove('shake'), 500);

          if (result.rarity === '5-star') {
              // Special glow effect for 5-star cards
              cardDiv.classList.add('five-star-glow');
              setTimeout(() => cardDiv.classList.remove('five-star-glow'), 2000);
          }

          if (index === results.length - 1) {
              document.getElementById('pity-counter').textContent = `Pity Counter: ${gacha.pityCounter}`;
              isAnimating = false;
              characterCollection.renderCharacters();
          }
      }, index * 300);
  });
}

// Attach event listeners
document.getElementById('pull-single-button').addEventListener('click', openGachaModalWithFullScreenReveal);
document.getElementById('close-modal').addEventListener('click', closeGachaModal);

// Close modal on outside click
window.addEventListener('click', (event) => {
  const modal = document.getElementById('gacha-modal');
  if (event.target === modal) {
    closeGachaModal();
  }
});

function initializeGameFromData() {
  defineCharactersFromData();
  initializeBannersFromData();
  updateBannerInfo();
}

function initializeApp() {
  loadGameData();

  // Initialize banners
  const oneDay = 24 * 60 * 60 * 1000;

  gacha.addBanner(new Banner('Standard Wish', 'Keqing', ['Barbara', 'Fischl', 'Noelle'], Infinity, Date.now()));
  gacha.addBanner(new Banner('Ballad in Goblets', 'Venti', ['Xiangling', 'Razor', 'Sucrose'], 14 * oneDay, Date.now())); // Starts in 7 days
  gacha.addBanner(new Banner('Sparkling Steps', 'Klee', ['Xingqiu', 'Noelle', 'Sucrose'], 14 * oneDay, Date.now() + oneDay * 21)); // Starts in 21 days
  gacha.addBanner(new Banner('Farewell of Snezhnaya', 'Tartaglia', ['Diona', 'Beidou', 'Ningguang'], 14 * oneDay, Date.now() + oneDay * 35)); // Starts in 35 days
  gacha.addBanner(new Banner('Gentry of Hermitage', 'Zhongli', ['Xinyan', 'Razor', 'Chongyun'], 14 * oneDay, Date.now() + oneDay * 49)); // Starts in 49 days
  gacha.addBanner(new Banner('Secretum Secretorum', 'Albedo', ['Fischl', 'Sucrose', 'Bennett'], 14 * oneDay, Date.now() + oneDay * 63)); // Starts in 63 days
  

  createBannerButtons();
  initializeBannerScroll();

  function initializeNavigation() {
    document.getElementById('gacha-button').addEventListener('click', () => app.showPage('gacha-page'));
    document.getElementById('collection-button').addEventListener('click', () => app.showPage('character-collection-page'));
    document.getElementById('autobattler-button').addEventListener('click', () => app.showPage('autobattler-page'));
    document.getElementById('weapon-management-button').addEventListener('click', () => app.showPage('weapon-management-page'));
    
  }
  initializeNavigation();

  characterCollection.init();
  autobattler.initializePage();
  weaponManagement.init();

  // Add abilities and characters
  defineAbilities(characterManager);

  updateBannerInfo();
  renderBanners();

}


// ===================================
// Event Listeners
// ===================================

let isAnimating = false;

document.getElementById('item-modal').addEventListener('click', function () {
  this.style.display = 'none';
});

// ===================================
// DOMContentLoaded - Start App
// ===================================
document.addEventListener('DOMContentLoaded', initializeApp);
