import { hexToRgb } from "@mui/material";
import localforage from 'localforage';
import * as vec3 from 'gl-matrix/vec3';
import * as mat3 from 'gl-matrix/mat3';
import { MoorhenMolecule } from "./MoorhenMolecule";
import { MoorhenMap } from "./MoorhenMap";
import { moorhen } from "../types/moorhen";
import { gemmi } from "../types/gemmi";
import { webGL } from "../types/mgWebGL";
import { AnyAction, Dispatch } from "@reduxjs/toolkit";
import { addMolecule, emptyMolecules } from "../store/moleculesSlice";
import { addMap, emptyMaps } from "../store/mapsSlice";
import { batch } from "react-redux";
import { setActiveMap } from "../store/generalStatesSlice";
import { setContourLevel, setMapAlpha, setMapRadius, setMapStyle } from "../store/mapContourSettingsSlice";

export const getLigandSVG = async (commandCentre: React.RefObject<moorhen.CommandCentre>, imol: number, compId: string, isDark: boolean): Promise<string> => {
    const result = await commandCentre.current.cootCommand({
        returnType: "string",
        command: 'get_svg_for_residue_type',
        commandArgs: [imol, compId, false, isDark],
    }, false) as moorhen.WorkerResponse<string>
    
    const parser = new DOMParser()
    let theText = result.data.result.result
    let doc = parser.parseFromString(theText, "image/svg+xml")
    let xmin = 999
    let ymin = 999
    let xmax = -999
    let ymax = -999
    
    let lines = doc.getElementsByTagName("line")
    for (let l of lines) {
        const x1 = parseFloat(l.getAttribute("x1"))
        const y1 = parseFloat(l.getAttribute("y1"))
        const x2 = parseFloat(l.getAttribute("x2"))
        const y2 = parseFloat(l.getAttribute("y2"))
        if(x1>xmax) xmax = x1
        if(x1<xmin) xmin = x1
        if(y1>ymax) ymax = y1
        if(y1<ymin) ymin = y1
        if(x2>xmax) xmax = x2
        if(x2<xmin) xmin = x2
        if(y2>ymax) ymax = y2
        if(y2<ymin) ymin = y2
    }
    
    let texts = doc.getElementsByTagName("text");
    for (let t of texts) {
        const x = parseFloat(t.getAttribute("x"))
        const y = parseFloat(t.getAttribute("y"))
        if(x>xmax) xmax = x
        if(x<xmin) xmin = x
        if(y>ymax) ymax = y
        if(y<ymin) ymin = y
    }
    
    let polygons = doc.getElementsByTagName("polygon");
    for (let poly of polygons) {
        const points = poly.getAttribute("points").trim().split(" ")
        for (const point of points) {
            const xy = point.split(",")
            const x = parseFloat(xy[0])
            const y = parseFloat(xy[1])
            if(x>xmax) xmax = x
            if(x<xmin) xmin = x
            if(y>ymax) ymax = y
            if(y<ymin) ymin = y
        }
    }

    xmin -= 20
    ymin -= 20
    xmax += 30
    ymax -= ymin - 10
    let svgs = doc.getElementsByTagName("svg")
    const viewBoxStr = xmin+" "+ymin+" "+xmax+" "+ymax
    for (let item of svgs) {
        item.setAttribute("viewBox" , viewBoxStr)
        item.setAttribute("width" , "100%")
        item.setAttribute("height" , "100%")
        theText = item.outerHTML
    }
    
    return theText 
}

export const rgbToHsv = (r: number, g:number, b:number): [number, number, number] => {
    const cMax = Math.max(r, g, b)
    const cMin = Math.min(r, g, b)
    const delta = cMax - cMin

    let hue: number
    if (delta === 0) {
        hue = 0
    } else if (r === cMax) {
        hue = 60 * (((g - b) / delta) % 6)
    } else if (g === cMax) {
        hue = 60 * (((b - r) / delta) + 2)
    } else {
        hue = 60 * (((r - g) / delta) + 4)
    }

    let saturation: number
    if (cMax === 0) {
        saturation = 0
    } else {
        saturation = delta / cMax
    }

    return [hue, saturation, cMax]
}

export const hsvToRgb = (hue: number, saturation: number, value: number): [number, number, number] => {
    const c = value * saturation
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
    const m = value - c
    let rgb: [number, number, number]

    if (0 <= hue && hue < 60) {
        rgb = [c, x, 0]
    } else if (60 <= hue && hue < 120) {
        rgb = [x, c, 0]
    } else if (120 <= hue && hue < 180) {
        rgb = [0, c, x]
    } else if (180 <= hue && hue < 240) {
        rgb = [0, x, c]
    } else if (240 <= hue && hue < 300) {
        rgb = [x, 0, c]
    } else if (300 <= hue && hue < 360) {
        rgb = [c, 0, x]
    }

    return rgb.map(component => component + m) as [number, number, number]
}

export const getRandomMoleculeColour = (min: number = 127, max: number = 160) => {
    const randomComponent_A = Math.floor(Math.random() * (max - min + 1)) + min
    const randomComponent_B = max
    const randomComponent_C = min
    let result = [randomComponent_A, randomComponent_B, randomComponent_C]
    result = result.sort((a, b) => 0.5 - Math.random());
    return rgbToHex(...result as [number, number, number])
}

export function guid(): string {
    let d = Date.now();
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

export function sequenceIsValid(sequence: moorhen.ResidueInfo[]): boolean {
    // If no sequence is present
    if (!sequence || sequence.length === 0) {
        return false
    }
    // If any residue doesn't have rigth attributes
    if (sequence.some(residue => !Object.keys(residue).includes('resNum') || !Object.keys(residue).includes('resCode'))) {
        return false
    }
    // If any of the residues has undefined or Nan as the residue code or residue number
    if (sequence.some(residue => residue.resNum === null || isNaN(residue.resNum) || typeof residue.resNum === 'undefined' || residue.resCode === null || typeof residue.resCode === 'undefined')) {
        return false
    }
    return true
}
/**
 * A function to load session data
 * @param {string} sessionDataString - A JSON string representation of the object containing session data
 * @param {string} monomerLibraryPath - Path to the monomer library
 * @param {moorhen.Molecule[]} molecules - State containing current molecules loaded in the session
 * @param {moorhen.Map[]} maps - State containing current maps loaded in the session
 * @param {React.RefObject<moorhen.CommandCentre>} commandCentre - React reference to the command centre
 * @param {React.RefObject<moorhen.TimeCapsule>} timeCapsuleRef - React reference to the time capsule
 * @param {React.RefObject<webGL.MGWebGL>} glRef - React reference to the webGL renderer
 * @param {Dispatch<AnyAction>} dispatch - Dispatch method for the MoorhenReduxStore
 * @returns {number} Returns -1 if there was an error loading the session otherwise 0
 */
export async function loadSessionData(
    sessionDataString: string,
    monomerLibraryPath: string,
    molecules: moorhen.Molecule[],
    maps: moorhen.Map[],
    commandCentre: React.RefObject<moorhen.CommandCentre>,
    timeCapsuleRef: React.RefObject<moorhen.TimeCapsule>,
    glRef: React.RefObject<webGL.MGWebGL>,
    dispatch: Dispatch<AnyAction>
): Promise<number> {

    timeCapsuleRef.current.setBusy(true)
    const sessionData: moorhen.backupSession = JSON.parse(sessionDataString)

    if (!sessionData) {
        return -1
    } else if (!Object.hasOwn(sessionData, 'version') || timeCapsuleRef.current.version !== sessionData.version) {
        console.warn('Outdated session backup version, wont load...')
        return -1
    }
    
    // Delete current scene
    molecules.forEach(molecule => {
        molecule.delete()
    })

    maps.forEach(map => {
        map.delete()
    })
    
    batch(() => {
        dispatch( emptyMolecules() )
        dispatch( emptyMaps() )    
    })

    // Load molecules stored in session from coords string
    const newMoleculePromises = sessionData.moleculeData.map(storedMoleculeData => {
        const newMolecule = new MoorhenMolecule(commandCentre, glRef, monomerLibraryPath)
        return newMolecule.loadToCootFromString(storedMoleculeData.coordString, storedMoleculeData.name)
    })
    
    // Load maps stored in session
    const newMapPromises = sessionData.mapData.map(storedMapData => {
        const newMap = new MoorhenMap(commandCentre, glRef)
        if (sessionData.includesAdditionalMapData) {
            return newMap.loadToCootFromMapData(
                Uint8Array.from(Object.values(storedMapData.mapData)).buffer, 
                storedMapData.name, 
                storedMapData.isDifference
                )
        } else {
            newMap.uniqueId = storedMapData.uniqueId
            return timeCapsuleRef.current.retrieveBackup(
                JSON.stringify({
                    type: 'mapData',
                    name: storedMapData.uniqueId
                })
                ).then(mapData => {
                    return newMap.loadToCootFromMapData(
                        mapData as Uint8Array, 
                        storedMapData.name, 
                        storedMapData.isDifference
                        )
                    })    
        }
    })
    
    const loadPromises = await Promise.all([...newMoleculePromises, ...newMapPromises])
    const newMolecules = loadPromises.filter(item => item.type === 'molecule') as moorhen.Molecule[] 
    const newMaps = loadPromises.filter(item => item.type === 'map') as moorhen.Map[] 
    
    // Draw the molecules with the styles stored in session (needs to be done sequentially due to colour rules)
    for (let i = 0; i < newMolecules.length; i++) {
        const molecule = newMolecules[i]
        const storedMoleculeData = sessionData.moleculeData[i]
        await Promise.all(Object.keys(storedMoleculeData.ligandDicts).map(compId => molecule.addDict(storedMoleculeData.ligandDicts[compId])))
        molecule.defaultColourRules = storedMoleculeData.defaultColourRules
        molecule.defaultBondOptions = storedMoleculeData.defaultBondOptions
        for (const item of storedMoleculeData.representations) {
            await molecule.addRepresentation(item.style, item.cid, item.isCustom, item.colourRules, item.bondOptions)
        }
    }
    
    // Associate maps to reflection data
    await Promise.all(
        newMaps.map((map, index) => {
            const storedMapData = sessionData.mapData[index]
            if (sessionData.includesAdditionalMapData && storedMapData.reflectionData) {
                return map.associateToReflectionData(
                    storedMapData.selectedColumns, 
                    Uint8Array.from(Object.values(storedMapData.reflectionData))
                )
            } else if(storedMapData.associatedReflectionFileName && storedMapData.selectedColumns) {
                return timeCapsuleRef.current.retrieveBackup(
                    JSON.stringify({
                        type: 'mtzData',
                        name: storedMapData.associatedReflectionFileName
                    })
                    ).then(reflectionData => {
                        return map.associateToReflectionData(
                            storedMapData.selectedColumns, 
                            Uint8Array.from(Object.values(reflectionData))
                        )
                    })
            }
            return Promise.resolve()
        })
    )

    // Add molecules
    newMolecules.forEach(molecule => {
        dispatch( addMolecule(molecule) )
    })

    // Add maps
    newMaps.forEach((map, index) => {
        const storedMapData = sessionData.mapData[index]
        map.showOnLoad = storedMapData.showOnLoad
        map.suggestedRadius = storedMapData.radius
        map.suggestedContourLevel = storedMapData.contourLevel
        map.rgba = storedMapData.rgba
        map.style = storedMapData.style
        batch(() => {
            dispatch( setMapRadius({molNo: map.molNo, radius: storedMapData.radius}) )
            dispatch( setContourLevel({molNo: map.molNo, contourLevel: storedMapData.contourLevel}) )
            dispatch( setMapAlpha({molNo: map.molNo, alpha: storedMapData.rgba.a}) )
            dispatch( setMapStyle({molNo: map.molNo, style: storedMapData.style}) )
            dispatch( addMap(map) )                
        })
    })

    // Set active map
    if (sessionData.activeMapIndex !== -1){
        dispatch( setActiveMap(newMaps[sessionData.activeMapIndex]) )
    }

    // Set camera details
    glRef.current.setAmbientLightNoUpdate(...Object.values(sessionData.viewData.ambientLight) as [number, number, number])
    glRef.current.setSpecularLightNoUpdate(...Object.values(sessionData.viewData.specularLight) as [number, number, number])
    glRef.current.setDiffuseLightNoUpdate(...Object.values(sessionData.viewData.diffuseLight) as [number, number, number])
    glRef.current.setLightPositionNoUpdate(...Object.values(sessionData.viewData.lightPosition) as [number, number, number])
    glRef.current.setZoom(sessionData.viewData.zoom, false)
    glRef.current.set_fog_range(sessionData.viewData.fogStart, sessionData.viewData.fogEnd, false)
    glRef.current.set_clip_range(sessionData.viewData.clipStart, sessionData.viewData.clipEnd, false)
    glRef.current.doDrawClickedAtomLines = sessionData.viewData.doDrawClickedAtomLines
    glRef.current.background_colour = sessionData.viewData.backgroundColor
    glRef.current.setOrigin(sessionData.viewData.origin, false)
    glRef.current.setQuat(sessionData.viewData.quat4)

    // Set connected maps and molecules if any
    const connectedMoleculeIndex = sessionData.moleculeData.findIndex(molecule => molecule.connectedToMaps !== null)
    if (connectedMoleculeIndex !== -1) {
        const oldConnectedMolecule = sessionData.moleculeData[connectedMoleculeIndex]        
        const molecule = newMolecules[connectedMoleculeIndex].molNo
        const [reflectionMap, twoFoFcMap, foFcMap] = oldConnectedMolecule.connectedToMaps.map(item => newMaps[sessionData.mapData.findIndex(map => map.molNo === item)].molNo)
        const connectMapsArgs = [molecule, reflectionMap, twoFoFcMap, foFcMap]
        const sFcalcArgs = [molecule, twoFoFcMap, foFcMap, reflectionMap]
        
        await commandCentre.current.cootCommand({
            command: 'connect_updating_maps',
            commandArgs: connectMapsArgs,
            returnType: 'status'
        }, false)
            
        await commandCentre.current.cootCommand({
            command: 'sfcalc_genmaps_using_bulk_solvent',
            commandArgs: sFcalcArgs,
            returnType: 'status'
        }, false)
                
        const connectedMapsEvent: moorhen.ConnectMapsEvent = new CustomEvent("connectMaps", {
            "detail": {
                molecule: molecule,
                maps: [reflectionMap, twoFoFcMap, foFcMap],
                uniqueMaps: [...new Set([reflectionMap, twoFoFcMap, foFcMap].slice(1))]
            }
        })
        document.dispatchEvent(connectedMapsEvent)
    }
    
    timeCapsuleRef.current.setBusy(false)
    return 0
}

export function convertRemToPx(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

export function convertViewtoPx(input: number, height: number): number {
    return height * (input / 100)
}

export const representationLabelMapping = {
    rama: "Rama.",
    rotamer: "Rota.",
    CBs: "Bonds",
    CAs: "C-As",
    CRs: "Ribbons",
    CDs: "Cont. dots",
    MolecularSurface: "Surf.",
    gaussian: "Gauss.",
    ligands: "Ligands",
    DishyBases: "Bases",
    VdwSpheres: "Spheres",
    allHBonds: "H-Bonds",
    glycoBlocks: "GlycoBlocks",
    restraints: "Restraints",
    MetaBalls: "MetaBalls"
}

export const residueCodesOneToThree = {
    'C': 'CYS',
    'D': 'ASP',
    'S': 'SER',
    'Q': 'GLN',
    'K': 'LYS',
    'I': 'ILE',
    'P': 'PRO',
    'T': 'THR',
    'F': 'PHE',
    'N': 'ASN',
    'G': 'GLY',
    'H': 'HIS',
    'L': 'LEU',
    'R': 'ARG',
    'W': 'TRP',
    'A': 'ALA',
    'V': 'VAL',
    'E': 'GLU',
    'Y': 'TYR',
    'M': 'MET',
    'UNK': 'UNKOWN',
    'X': 'UNKOWN',
    '-': 'MISSING'
}

export const residueCodesThreeToOne = {
    "ALA": 'A',
    "ARG": 'R',
    "ASN": 'N',
    "ASP": 'D',
    "CYS": 'C',
    "GLN": 'Q',
    "GLU": 'E',
    "GLY": 'G',
    "HIS": 'H',
    "ILE": 'I',
    "LEU": 'L',
    "LYS": 'K',
    "MET": 'M',
    "PHE": 'F',
    "PRO": 'P',
    "SER": 'S',
    "THR": 'T',
    "TRP": 'W',
    "TYR": 'Y',
    "VAL": 'V',
    "UNK": 'X',
}

export const nucleotideCodesOneToThree = {
    "A": "A",
    "T": "T",
    "G": "G",
    "C": "C",
    "U": "U",
    "N": "N",
    "I": "I",
    "X": "UNKOWN",
    'UNK': 'UNKOWN',
    '-': 'MISSING'
}

export const nucleotideCodesThreeToOne = {
    "A": "A",
    "T": "T",
    "G": "G",
    "C": "C",
    "U": "U",
    "N": "N",
    "I": "I",
    "DT": "T",
    "DG": "G",
    "DC": "C",
    "DA": "A",
    "DU": "U",
    "ADE": "A",
    "THY": "T",
    "GUA": "G",
    "CYT": "C",
    "URA": "U",
    "PSU": "U",
    "UNKOWN": "X",
    'UNK': 'X',
    'MISSING': '-'
}

export const windowsFonts = [
    'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
    'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets', 'Impact',
    'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya',
    'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei',
    'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype',
    'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Historic', 'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun',
    'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic'
]

export const macFonts = [
    'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir',
    'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand',
    'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New',
    'Didot', 'DIN Alternate', 'DIN Condensed', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text',
    'Impact', 'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Microsoft Sans Serif', 'Monaco', 'Noteworthy', 'Optima', 'Palatino', 'Papyrus',
    'Phosphate', 'Rockwell', 'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times', 'Times New Roman', 'Trattatello', 'Trebuchet MS',
    'Verdana', 'Zapfino'
]

export const linuxFonts = [
    "Liberation Sans", "Nimbus Sans L", "FreeSans", "DejaVu Sans", "Bitstream Vera Sans", "Geneva", "Liberation Serif", "Nimbus Roman No 9 L",
    "FreeSerif", "Hoefler Text", "Times", "Times New Roman", "Bitstream Charter", "URW Palladio L", "Palatino", "Palatino Linotype", "Book Antiqua",
    "DejaVu Serif", "Bitstream Vera Serif", "Century Schoolbook L", "Lucida Bright", "Georgia", "Liberation Mono", "Nimbus Mono L", "FreeMono",
    "Bitstream Vera Mono", "Lucida Console", "DejaVu Mono"
]

export const webSafeFonts = [
    "Comic Sans", "Courier New", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Palatino", "Tahoma", "Arial", "Impact"
]

export const allFontsSet = new Set([webSafeFonts, windowsFonts, macFonts, linuxFonts].flat().sort());

export const readTextFile = (source: File): Promise<ArrayBuffer | string> => {
    const resolveReader = (reader: FileReader, resolveCallback) => {
        reader.removeEventListener("load", resolveCallback)
        resolveCallback(reader.result)
    }

    return new Promise((resolve, reject) => {
        const reader: FileReader = new FileReader();
        reader.addEventListener("load", () => resolveReader(reader, resolve))
        reader.readAsText(source);
    })
}

export const readDataFile = (source: File): Promise<ArrayBuffer> => {
    const resolveReader = (reader: FileReader, resolveCallback) => {
        reader.removeEventListener("load", resolveCallback)
        if (typeof reader.result === 'string') {
            resolveCallback(JSON.parse(reader.result));
        } else {
            resolveCallback(reader.result)
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolveReader(reader, resolve))
        reader.readAsArrayBuffer(source)
    })
}

export const doDownload = (data: BlobPart[], targetName: string) => {
    const url = window.URL.createObjectURL(
        new Blob(data),
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
        'download',
        targetName,
    );

    // Append to html link element page
    document.body.appendChild(link);

    // Start download
    link.click();

    // Clean up and remove the link
    link.parentNode.removeChild(link);
}

export const doDownloadText = (text: string, filename: string) => {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

export const readGemmiStructure = (coordData: ArrayBuffer | string, molName: string): gemmi.Structure => {
    const structure: gemmi.Structure = window.CCP4Module.read_structure_from_string(coordData, molName)
    return structure
}

export const centreOnGemmiAtoms = (atoms: moorhen.AtomInfo[]): [number, number, number] => {
    const atomCount = atoms.length
    if (atomCount === 0) {
        return [0, 0, 0]
    }

    let xtot = 0.0
    let ytot = 0.0
    let ztot = 0.0

    for (const atom of atoms) {
        xtot += atom.x
        ytot += atom.y
        ztot += atom.z
    }

    return [-xtot / atomCount, -ytot / atomCount, -ztot / atomCount]
}

export const cidToSpec = (cid: string): moorhen.ResidueSpec => {
    //molNo, chain_id, res_no, ins_code, alt_conf
    const ResNameRegExp = /\(([^)]+)\)/;
    const cidTokens = cid.split('/')
    const mol_name = cidTokens[0]
    const mol_no = cidTokens[1]
    const chain_id = cidTokens[2]
    const res_no = parseInt(cidTokens[3])
    const res_name = ResNameRegExp.exec(cidTokens[3])?.length > 0 ? ResNameRegExp.exec(cidTokens[3])[0].replace('(', '').replace(')', '') : null
    const ins_code = (cidTokens.length > 3 && cidTokens[3].split(".").length > 1) ? cidTokens[3].split(".")[1] : ""
    const atom_name = cidTokens.length > 4 ? cidTokens[4].split(":")[0] : ""
    const alt_conf = atom_name && cidTokens[4].split(":").length > 1 ? cidTokens[4].split(":")[1] : ""
    return { mol_name, mol_no, chain_id, res_no, res_name, atom_name, ins_code, alt_conf, cid }
}

type ResidueInfoType = {
    modelIndex: number;
    molName: string;
    chain: string;
    seqNum: number;
    resCode: string;
}

export const getResidueInfo = (molecules: moorhen.Molecule[], selectedMolNo: number, selectedChain: string, selectedResidueIndex: number): ResidueInfoType => {
    const selectedMolecule = molecules.find(molecule => molecule.molNo === selectedMolNo)
    if (selectedMolecule) {
        const sequence = selectedMolecule.sequences.find(sequence => sequence.chain === selectedChain)
        if (sequence) {
            const sequenceData = sequence.sequence
            const { resNum, resCode } = sequenceData[selectedResidueIndex];
            if (resNum && resNum > -1) {
                return {
                    modelIndex: 0,
                    molName: selectedMolecule.name,
                    chain: selectedChain,
                    seqNum: resNum,
                    resCode: resCode
                }
            }
        }
    }
}

export const getTooltipShortcutLabel = (shortCut: moorhen.Shortcut): string => {
    let modifiers = []
    if (shortCut.modifiers.includes('shiftKey')) modifiers.push("Shift")
    if (shortCut.modifiers.includes('ctrlKey')) modifiers.push("<Ctrl>")
    if (shortCut.modifiers.includes('metaKey')) modifiers.push("<Meta>")
    if (shortCut.modifiers.includes('altKey')) modifiers.push("<Alt>")
    if (shortCut.keyPress === " ") modifiers.push("<Space>")
    return modifiers.length > 0 ? `<${modifiers.join(" ")} ${shortCut.keyPress.toUpperCase()}>` : `<${shortCut.keyPress.toUpperCase()}>`
}

export function componentToHex(c: number): string {
    const hex = c.toString(16)
    return hex.length === 1 ? "0" + hex : hex
}

export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b)
}

const getBfactorColourRules = (bFactors: { cid: string; bFactor: number; normalised_bFactor: number }[], normaliseBFactors: boolean = true): string => {
    const getColour = (bFactor: number): string => {
        let r: number, g: number, b: number
        if (bFactor <= 25) {
            r = 0
            g = Math.round(10.2 * bFactor)
            b = 255
        } else if (bFactor <= 50) {
            r = 0
            g = 255
            b = Math.round(510 - 10.2 * bFactor)
        } else if (bFactor <= 75) {
            r = Math.round(10.2 * (bFactor - 50))
            g = 255
            b = 0
        } else {
            r = 255
            g = Math.round(510 - 10.2 * (bFactor - 50))
            b = 0
        }
        return rgbToHex(r, g, b)
    }
    
    const bFactorAttr = normaliseBFactors ? 'normalised_bFactor' : 'bFactor'
    return bFactors.map(item => `${item.cid}^${getColour(item[bFactorAttr])}`).join('|')
}

const getPlddtColourRules = (plddtList: { cid: string; bFactor: number; }[]): string => {
    const getColour = (plddt: number) => {
        let r: number, g: number, b: number
        if (plddt <= 50) {
            r = 230
            g = 113
            b = 62
        } else if (plddt <= 70) {
            r = 230
            g = 197
            b = 17
        } else if (plddt < 90) {
            r = 91
            g = 183
            b = 219
        } else {
            r = 0
            g = 75
            b = 193
        }
        return rgbToHex(r, g, b)
    }

    return plddtList.map(item => `${item.cid}^${getColour(item.bFactor)}`).join('|')
}

const getNcsColourRules = (ncsRelatedChains: string[][]): string => {
    let result: string[]  = []
    ncsRelatedChains.forEach(chains => {
        const randColour = getRandomMoleculeColour()
        chains.forEach(chain => {
            result.push(`//${chain}^${randColour}`)
        })
    })
    return result.join('|')
}

export const getMultiColourRuleArgs = async (molecule: moorhen.Molecule, ruleType: string): Promise<string> => {

    let multiRulesArgs: string
    switch (ruleType) {
        case 'b-factor':
        case 'b-factor-norm':
            const bFactors = molecule.getResidueBFactors()
            multiRulesArgs = getBfactorColourRules(bFactors, ruleType === 'b-factor-norm')
            break;
        case 'af2-plddt':
            const plddt = molecule.getResidueBFactors()
            multiRulesArgs = getPlddtColourRules(plddt)
            break;
        case 'mol-symm':
            const ncsRelatedChains = await molecule.getNcsRelatedChains()
            multiRulesArgs = getNcsColourRules(ncsRelatedChains)
            break;
        default:
            console.log('Unrecognised colour rule...')
            break;
    }

    return multiRulesArgs
}

export const hexToHsl = (hex: string): [number, number, number] => {
    let [r, g, b]: number[] = hexToRgb(hex).replace('rgb(', '').replace(')', '').split(', ').map(item => parseFloat(item))
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number, l: number = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: break;
        }

        h /= 6;
    }

    return [h, s, l];
}

export const createLocalStorageInstance = (name: string, empty: boolean = false): moorhen.LocalStorageInstance => {
    const instance = localforage.createInstance({
        driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
        name: name,
        storeName: name
    })
    if (empty) {
        instance.clear()
    }
    return instance
}

export const getDashedCylinder = (nsteps: number, cylinder_accu: number): [number[], number[], number[]] => {
    let thisPos = []
    let thisNorm = []
    let thisIdxs = []

    let ipos = 0
    let maxIdx = 0

    const dash_step = 1.0 / nsteps

    for (let i = 0; i < nsteps / 2; i++, ipos += 2) {
        const z = ipos * dash_step;
        const zp1 = (ipos + 1) * dash_step;
        for (let j = 0; j < 360; j += 360 / cylinder_accu) {
            const theta1 = j * Math.PI / 180.0;
            const theta2 = (j + 360 / cylinder_accu) * Math.PI / 180.0;
            const x1 = Math.sin(theta1);
            const y1 = Math.cos(theta1);
            const x2 = Math.sin(theta2);
            const y2 = Math.cos(theta2);
            thisNorm.push(...[x1, y1, 0.0])
            thisNorm.push(...[x1, y1, 0.0])
            thisNorm.push(...[x2, y2, 0.0])
            thisNorm.push(...[x2, y2, 0.0])
            thisPos.push(...[x1, y1, z])
            thisPos.push(...[x1, y1, zp1])
            thisPos.push(...[x2, y2, z])
            thisPos.push(...[x2, y2, zp1])
            thisIdxs.push(...[0 + maxIdx, 1 + maxIdx, 2 + maxIdx])
            thisIdxs.push(...[1 + maxIdx, 3 + maxIdx, 2 + maxIdx])
            maxIdx += 4
            thisPos.push(...[x1, y1, z])
            thisPos.push(...[x2, y2, z])
            thisPos.push(...[0.0, 0.0, z])
            thisNorm.push(...[0.0, 0.0, 1.0])
            thisNorm.push(...[0.0, 0.0, 1.0])
            thisNorm.push(...[0.0, 0.0, 1.0])
            thisIdxs.push(...[0 + maxIdx, 2 + maxIdx, 1 + maxIdx])
            maxIdx += 3
            thisPos.push(...[x1, y1, zp1])
            thisPos.push(...[x2, y2, zp1])
            thisPos.push(...[0.0, 0.0, zp1])
            thisNorm.push(...[0.0, 0.0, -1.0])
            thisNorm.push(...[0.0, 0.0, -1.0])
            thisNorm.push(...[0.0, 0.0, -1.0])
            thisIdxs.push(...[0 + maxIdx, 1 + maxIdx, 2 + maxIdx])
            maxIdx += 3
        }
    }

    return [thisPos, thisNorm, thisIdxs]
}

export const gemmiAtomPairsToCylindersInfo = (
    atoms: [{ pos: [number, number, number], serial: (number | string) }, { pos: [number, number, number], serial: (number | string) }][],
    size: number,
    colourScheme: { [x: string]: number[]; },
    labelled: boolean = false,
    minDist: number = 1.9,
    maxDist: number = 4.0,
    dashed: boolean = true
) => {

    let atomPairs = atoms;

    let totIdxs = []
    let totPos = []
    let totNorm = []
    let totInstance_sizes = []
    let totInstance_colours = []
    let totInstance_origins = []
    let totInstance_orientations = []
    let totInstanceUseColours = []
    let totInstancePrimTypes = []

    const [thisPos, thisNorm, thisIdxs] = getDashedCylinder(dashed ? 15 : 1, 16);

    let thisInstance_sizes = []
    let thisInstance_colours = []
    let thisInstance_origins = []
    let thisInstance_orientations = []

    let totTextPrimTypes = []
    let totTextIdxs = []
    let totTextPrimPos = []
    let totTextPrimNorm = []
    let totTextPrimCol = []
    let totTextLabels = []


    for (let iat = 0; iat < atomPairs.length; iat++) {
        const at0 = atomPairs[iat][0];
        const at1 = atomPairs[iat][1];
        let ab = vec3.create()
        let midpoint = vec3.create()

        vec3.set(ab, at0.pos[0] - at1.pos[0], at0.pos[1] - at1.pos[1], at0.pos[2] - at1.pos[2])
        vec3.set(midpoint, 0.5 * (at0.pos[0] + at1.pos[0]), 0.5 * (at0.pos[1] + at1.pos[1]), 0.5 * (at0.pos[2] + at1.pos[2]))
        const l = vec3.length(ab)

        totTextLabels.push(l.toFixed(2))
        totTextIdxs.push(iat) // Meaningless, I think
        totTextPrimNorm.push(...[0, 0, 1]) // Also meaningless, I think
        totTextPrimPos.push(...[midpoint[0], midpoint[1], midpoint[2]])

        if (l > maxDist || l < minDist) continue;

        for (let ip = 0; ip < colourScheme[`${at0.serial}`].length; ip++) {
            thisInstance_colours.push(colourScheme[`${at0.serial}`][ip])
            totTextPrimCol.push(colourScheme[`${at0.serial}`][ip])
        }
        thisInstance_origins.push(...at0.pos)
        thisInstance_sizes.push(...[size, size, l])
        let v = vec3.create()
        let au = vec3.create()
        let a = vec3.create()
        let b = vec3.create()
        let aup = at0.pos.map((v, i) => v - at1.pos[i])
        vec3.set(au, ...aup)
        vec3.normalize(a, au)
        vec3.set(b, 0.0, 0.0, -1.0)
        vec3.cross(v, a, b)
        const c = vec3.dot(a, b)
        if (Math.abs(c + 1.0) < 1e-4) {
            thisInstance_orientations.push(...[
                -1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, -1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ])
        } else {
            const s = vec3.length(v)
            let k = mat3.create()
            k.set([
                0.0, -v[2], v[1],
                v[2], 0.0, -v[0],
                -v[1], v[0], 0.0,
            ])
            let kk = mat3.create()
            mat3.multiply(kk, k, k)
            let sk = mat3.create()
            mat3.multiplyScalar(sk, k, 1.0)
            let omckk = mat3.create()
            mat3.multiplyScalar(omckk, kk, 1.0 / (1.0 + c))
            let r = mat3.create()
            r.set([
                1.0, 0.0, 0.0,
                0.0, 1.0, 0.0,
                0.0, 0.0, 1.0,
            ])
            mat3.add(r, r, sk)
            mat3.add(r, r, omckk)
            thisInstance_orientations.push(...[
                r[0], r[1], r[2], 1.0,
                r[3], r[4], r[5], 1.0,
                r[6], r[7], r[8], 1.0,
                0.0, 0.0, 0.0, 1.0,
            ])
        }
    }

    totNorm.push(thisNorm)
    totPos.push(thisPos)
    totIdxs.push(thisIdxs)
    totInstance_sizes.push(thisInstance_sizes)
    totInstance_origins.push(thisInstance_origins)
    totInstance_orientations.push(thisInstance_orientations)
    totInstance_colours.push(thisInstance_colours)
    totInstanceUseColours.push(true)
    totInstancePrimTypes.push("TRIANGLES")
    if (labelled)
        totTextPrimTypes.push("TEXTLABELS")

    if (labelled)
        return {
            prim_types: [totInstancePrimTypes, totTextPrimTypes],
            idx_tri: [totIdxs, totTextIdxs],
            vert_tri: [totPos, totTextPrimPos],
            norm_tri: [totNorm, totTextPrimNorm],
            col_tri: [totInstance_colours, totTextPrimCol],
            label_tri: [[], totTextLabels],
            instance_use_colors: [totInstanceUseColours, [false]],
            instance_sizes: [totInstance_sizes, []],
            instance_origins: [totInstance_origins, []],
            instance_orientations: [totInstance_orientations, []]
        }
    else
        return {
            prim_types: [totInstancePrimTypes],
            idx_tri: [totIdxs],
            vert_tri: [totPos],
            norm_tri: [totNorm],
            col_tri: [totInstance_colours],
            instance_use_colors: [totInstanceUseColours],
            instance_sizes: [totInstance_sizes],
            instance_origins: [totInstance_origins],
            instance_orientations: [totInstance_orientations]
        }

}

export const gemmiAtomsToCirclesSpheresInfo = (atoms: moorhen.AtomInfo[], size: number, primType: string, colourScheme: { [x: string]: any[]; }) => {

    let sphere_sizes = [];
    let sphere_col_tri = [];
    let sphere_vert_tri = [];
    let sphere_idx_tri = [];
    let sphere_atoms = [];

    let totInstanceUseColours = []
    let totInstance_orientations = []

    for (let iat = 0; iat < atoms.length; iat++) {
        sphere_idx_tri.push(iat);
        sphere_vert_tri.push(atoms[iat].pos[0]);
        sphere_vert_tri.push(atoms[iat].pos[1]);
        sphere_vert_tri.push(atoms[iat].pos[2]);
        for (let ip = 0; ip < colourScheme[`${atoms[iat].serial}`].length; ip++) {
            sphere_col_tri.push(colourScheme[`${atoms[iat].serial}`][ip])
        }
        sphere_sizes.push(size);
        let atom = {};
        atom["x"] = atoms[iat].pos[0];
        atom["y"] = atoms[iat].pos[1];
        atom["z"] = atoms[iat].pos[2];
        atom["tempFactor"] = atoms[iat].tempFactor;
        atom["charge"] = atoms[iat].charge;
        atom["symbol"] = atoms[iat].element;
        atom["label"] = ""
        sphere_atoms.push(atom);
        if (primType === "PERFECT_SPHERES") {
            totInstanceUseColours.push(true);
            totInstance_orientations.push(...[
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ])
            sphere_sizes.push(size);
            sphere_sizes.push(size);
        }
    }

    if (primType === "PERFECT_SPHERES") {
        return {
            atoms: [[sphere_atoms]],
            instance_sizes: [[sphere_sizes]],
            instance_origins: [[sphere_vert_tri]],
            instance_use_colors: [[totInstanceUseColours]],
            instance_orientations: [[totInstance_orientations]],
            col_tri: [[sphere_col_tri]],
            norm_tri: [[[sphere_vert_tri]]],
            vert_tri: [[sphere_vert_tri]],
            idx_tri: [[sphere_idx_tri]],
            prim_types: [[primType]]
        }
    } else {
        return {
            atoms: [[sphere_atoms]],
            sizes: [[sphere_sizes]],
            col_tri: [[sphere_col_tri]],
            norm_tri: [[[]]],
            vert_tri: [[sphere_vert_tri]],
            idx_tri: [[sphere_idx_tri]],
            prim_types: [[primType]]
        }
    }
}

export const findConsecutiveRanges = (numbers: number[]): [number, number][] => {
    numbers.sort((a, b) => a - b);
    const ranges: [number, number][] = [];

    let start = numbers[0];
    let end = numbers[0];

    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === end + 1) {
            end = numbers[i];
        } else {
            ranges.push([start, end]);
            start = numbers[i];
            end = numbers[i];
        }
    }

    ranges.push([start, end]);
    return ranges;
}

export function getCubeLines(unitCell: gemmi.UnitCell): [{ pos: [number, number, number], serial: string }, { pos: [number, number, number], serial: string }][] {

    const orthogonalize = (x: number, y: number, z: number) => {
        const fractPosition = new window.CCP4Module.Fractional(x, y, z)
        const orthPosition = unitCell.orthogonalize(fractPosition)
        const result = [orthPosition.x, orthPosition.y, orthPosition.z] as [number, number, number]
        fractPosition.delete()
        orthPosition.delete()
        return result
    }

    const vertices: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1]
    ];

    const edges: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7]
    ];

    const lines: [{ pos: [number, number, number], serial: string }, { pos: [number, number, number], serial: string }][] = [];
    edges.forEach(edge => {
        const [v1Index, v2Index] = edge
        const v1 = {
            pos: orthogonalize(...vertices[v1Index]),
            serial: 'unit_cell'
        };
        const v2 = {
            pos: orthogonalize(...vertices[v2Index]),
            serial: 'unit_cell'
        };
        lines.push([v1, v2]);
    })

    return lines;
}

export const countResiduesInSelection = (gemmiStructure: gemmi.Structure, cidSelection?: string) => {
    const selection = new window.CCP4Module.Selection(cidSelection ? cidSelection : '/*/*/*')
    const count = window.CCP4Module.count_residues_in_selection(gemmiStructure, selection)
    selection.delete()
    return count    
}

export const copyStructureSelection = (gemmiStructure: gemmi.Structure, cidSelection?: string) => {
    const selection = new window.CCP4Module.Selection(cidSelection ? cidSelection : '/*/*/*')
    const newStruct = window.CCP4Module.remove_non_selected_atoms(gemmiStructure, selection)
    selection.delete()
    return newStruct
}

