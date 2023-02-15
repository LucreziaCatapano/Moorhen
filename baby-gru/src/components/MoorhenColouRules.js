import React, { useCallback, useEffect, useRef, useState, useReducer } from "react";
import { Row, Button, Stack, Form, FormSelect, Card, Col, OverlayTrigger, Tooltip } from "react-bootstrap";
import { ArrowUpwardOutlined, ArrowDownwardOutlined, AddOutlined, DeleteOutlined, DoneOutlined, DeleteForeverOutlined } from '@mui/icons-material';
import { SketchPicker } from "react-color";
import { MoorhenMoleculeSelect } from "./MoorhenMoleculeSelect";
import { MoorhenChainSelect } from "./MoorhenChainSelect";
import { convertViewtoPx, getMultiColourRuleArgs } from "../utils/MoorhenUtils";

const itemReducer = (oldList, change) => {
    if (change.action === 'Add') {
        return [...oldList, change.item]
    }
    else if (change.action === 'Remove') {
        return oldList.filter(item => item !== change.item)
    }
    else if (change.action === 'Empty') {
        return []
    }
    else if (change.action === 'Overwrite') {
        return [...change.items]
    }
    else if (change.action === 'MoveUp') {
        const itemIndex = oldList.findIndex(item => item === change.item)
        if (itemIndex === 0) {
            return oldList
        }
        let newList = oldList.slice()
        newList[itemIndex] = oldList[itemIndex - 1]
        newList[itemIndex - 1] = change.item
        return newList
    }
    else if (change.action === 'MoveDown') {
        const itemIndex = oldList.findIndex(item => item === change.item)
        if (itemIndex === oldList.length - 1) {
            return oldList
        }
        let newList = oldList.slice()
        newList[itemIndex] = oldList[itemIndex + 1]
        newList[itemIndex + 1] = change.item
        return newList
    }
}

const initialRuleState = []

export const MoorhenColourRules = (props) => {
    const moleculeSelectRef = useRef()
    const chainSelectRef = useRef()
    const ruleSelectRef = useRef()
    const cidFormRef = useRef()
    const [ruleType, setRuleType] = useState('molecule')
    const [colourPreset, setColourPreset] = useState('b-factor')
    const [selectedColour, setSelectedColour] = useState({r: 128, g: 128, b: 128, a: 0.5})
    const [selectedModel, setSelectedModel] = useState(null)
    const [selectedChain, setSelectedChain] = useState(null)
    const [cid, setCid] = useState(null)
    const [ruleList, setRuleList] = useReducer(itemReducer, initialRuleState)
    
    const handleModelChange = (evt) => {
        console.log(`Selected model ${evt.target.value}`)
        setSelectedModel(parseInt(evt.target.value))
    }

    const handleChainChange = (evt) => {
        console.log(`Selected chain ${evt.target.value}`)
        setSelectedChain(evt.target.value)
    }

    const handleResidueCidChange = (evt) => {
        console.log(`Selected residue CID ${evt.target.value}`)
        setCid(evt.target.value)
    }

    const handleColorChange = (color) => {
        try {
            setSelectedColour(color.hex)
        }
        catch (err) {
            console.log('err', err)
        }
    }

    const getRules = async (imol, commandCentre) => {
        
        const selectedMolecule = props.molecules.find(molecule => molecule.molNo === imol)
        if (selectedMolecule && selectedMolecule.colourRules) {
            return selectedMolecule.colourRules
        }

        let rules = []
        const response = await commandCentre.current.cootCommand({
            message:'coot_command',
            command: "get_colour_rules", 
            returnType:'colour_rules',
            commandArgs:[imol], 
        })

        response.data.result.result.forEach(rule => {
            rules.push({
                commandInput: {
                    message:'coot_command',
                    command: 'add_colour_rule', 
                    returnType:'status',
                    commandArgs: [imol, rule.first, rule.second]
                },
                isMultiColourRule: false,
                ruleType: 'chain',
                color: rule.second,
                label: rule.first
            })
        })

        selectedMolecule.colourRules = rules
        
        return rules
    }

    const createRule = () => {
        const selectedMolecule = props.molecules.find(molecule => molecule.molNo === selectedModel)
        if(!selectedMolecule) {
            return
        }

        let newRule
        if (ruleType !== 'preset') {
            const cidLabel = ruleType === 'molecule' ? "//*" : ruleType === 'chain' ? `//${chainSelectRef.current.value}` : cid
            newRule = {
                commandInput: {
                    message:'coot_command',
                    command: 'add_colour_rule', 
                    returnType:'status',
                    commandArgs: [selectedModel, cidLabel, selectedColour]
                },
                isMultiColourRule: false,
                ruleType: `${ruleType}`,
                color: selectedColour,
                label: cidLabel,
            }
        } else {
            newRule = {
                commandInput: {
                    message:'coot_command',
                    command: 'add_colour_rules_multi', 
                    returnType:'status',
                    commandArgs: getMultiColourRuleArgs(selectedMolecule, colourPreset)
                },
                isMultiColourRule: true,
                ruleType: `${colourPreset}`,
                color: selectedColour,
                label: `//*`,
            }
        }

        if (newRule) {
            setRuleList({action: 'Add', item: newRule})    
        }
    }

    const commitChanges = useCallback(async () => {
        if (ruleList.length === 0) {
            return
        }
        const selectedMolecule = props.molecules.find(molecule => molecule.molNo === selectedModel);
        
        await props.commandCentre.current.cootCommand({
            message:'coot_command',
            command: "delete_colour_rules", 
            returnType:'status',
            commandArgs: [selectedModel], 
        })

        const promises = ruleList.map(rule => 
            props.commandCentre.current.cootCommand(rule.commandInput)
        )

        await Promise.all(promises)
        
        selectedMolecule.colourRules = [...ruleList]
        selectedMolecule.setAtomsDirty(true)
        selectedMolecule.redraw(props.glRef)

    }, [selectedModel, ruleList, props.molecules, props.commandCentre, props.glRef])

    useEffect(() => {
        if (selectedModel !== null) {
            getRules(selectedModel, props.commandCentre).then(currentRules => {
                setRuleList({action: 'Overwrite', items: currentRules})
            })            
        } else {
            setRuleList({action: 'Empty'})
        }
    }, [selectedModel])

    useEffect(() => {
        if (props.molecules.length === 0) {
            setSelectedModel(null)
        } else if (selectedModel === null) {
            setSelectedModel(props.molecules[0].molNo)
        } else if (!props.molecules.map(molecule => molecule.molNo).includes(selectedModel)) {
            setSelectedModel(props.molecules[0].molNo)
        }
        
    }, [props.molecules.length])

    const getRuleCard = (rule, index) => {
        return <Card key={index} style={{margin: '0.1rem', maxWidth: '100%', overflowX:'scroll'}}>
                <Card.Body>
                    <Row className='align-items-center'>
                        <Col className='align-items-center' style={{ display: 'flex', justifyContent: 'left' }}>
                            {rule.label}
                        </Col>
                        <Col style={{ display: 'flex', justifyContent: 'right', alignItems:'center' }}>
                            {rule.isMultiColourRule ?
                            <img className="colour-rule-icon" src={`${props.urlPrefix}/baby-gru/pixmaps/temperature.svg`} alt='b-factor' style={{height:'28px', width:'`12px', margin: '0.1rem'}}/>
                            :
                             <div style={{borderColor: 'black', borderWidth:'5px', backgroundColor: rule.color, height:'20px', width:'20px', margin: '0.1rem'}}/>
                            }
                            <OverlayTrigger
                                placement="top"
                                delay={{ show: 400, hide: 400 }}
                                overlay={
                                    <Tooltip id="button-tooltip" {...props}>
                                        Move up
                                    </Tooltip>
                                }>
                                <Button size='sm' style={{margin: '0.1rem'}} variant={props.darkMode ? "dark" : "light"} onClick={() => {setRuleList({action:'MoveUp', item:rule})}}>
                                    <ArrowUpwardOutlined/>
                                </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                delay={{ show: 400, hide: 400 }}
                                overlay={
                                    <Tooltip id="button-tooltip" {...props}>
                                        Move down
                                    </Tooltip>
                                }>
                                <Button size='sm' style={{margin: '0.1rem'}} variant={props.darkMode ? "dark" : "light"} onClick={() => {setRuleList({action:'MoveDown', item:rule})}}>
                                    <ArrowDownwardOutlined/>
                                </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                delay={{ show: 400, hide: 400 }}
                                overlay={
                                    <Tooltip id="button-tooltip" {...props}>
                                        Delete
                                    </Tooltip>
                                }>
                                <Button size='sm' style={{margin: '0.1rem'}} variant={props.darkMode ? "dark" : "light"} onClick={() => {setRuleList({action:'Remove', item:rule})}}>
                                    <DeleteOutlined/>
                                </Button>
                            </OverlayTrigger>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
    }

    return <>
                <Stack gap={2} style={{alignItems: 'center'}}>
                    <Form.Group style={{ margin: '0.1rem', width: '100%' }}>
                        <Form.Label>Rule type</Form.Label>
                        <FormSelect size="sm" ref={ruleSelectRef} defaultValue={'molecule'} onChange={(val) => setRuleType(val.target.value)}>
                            <option value={'molecule'} key={'molecule'}>By molecule</option>
                            <option value={'chain'} key={'chain'}>By chain</option>
                            <option value={'cid'} key={'cid'}>By CID</option>
                            <option value={'preset'} key={'preset'}>By colour preset</option>
                        </FormSelect>
                    </Form.Group>
                        <Stack gap={2} style={{alignItems: 'center'}}>
                            <MoorhenMoleculeSelect width="100%" onChange={handleModelChange} molecules={props.molecules} ref={moleculeSelectRef}/>
                            {ruleType === 'chain'  && <MoorhenChainSelect width="100%" molecules={props.molecules} onChange={handleChainChange} selectedCoordMolNo={selectedModel} ref={chainSelectRef} allowedTypes={[1, 2]}/>}
                            {ruleType === 'cid' && 
                                <Form.Group style={{ width: "100%", margin: '0.1rem' }}>
                                    <Form.Label>Selection CID</Form.Label>
                                    <Form.Control size="sm" type='text' defaultValue={''} style={{width: "100%"}} onChange={handleResidueCidChange} ref={cidFormRef}/>
                                </Form.Group>
                            }
                            {ruleType === 'preset' && 
                                <Form.Group style={{ margin: '0.1rem', width: '100%' }}>
                                    <Form.Label>Color preset</Form.Label>
                                    <FormSelect size="sm" ref={ruleSelectRef} defaultValue={'b-factor'} onChange={(val) => setColourPreset(val.target.value)}>
                                        <option value={'b-factor'} key={'b-factor'}>B-Factor</option>
                                    </FormSelect>
                                </Form.Group>
                            }
                            <Stack direction="horizontal" gap={2} style={{alignItems: 'center'}}>
                                <div style={{display: ruleType === 'preset' ? 'none' : ''}}>
                                    <SketchPicker color={selectedColour} onChange={handleColorChange} />
                                </div>
                                <Card style={{width:'100%', margin:'0rem'}}>
                                    <Card.Body style={{padding:'0.2rem', maxHeight: convertViewtoPx(25, props.windowHeight), overflowY: 'auto', textAlign:'center'}}>
                                        {ruleList.length === 0 ? 
                                            "No rules created yet"
                                        :
                                        ruleList.map((rule, index) => getRuleCard(rule, index))}
                                    </Card.Body>
                                </Card>
                            <Stack gap={2} style={{alignItems: 'center', justifyContent: 'center'}}>
                                <OverlayTrigger
                                    placement="right"
                                    delay={{ show: 400, hide: 400 }}
                                    overlay={
                                        <Tooltip id="button-tooltip" {...props}>
                                            Add a rule
                                        </Tooltip>
                                    }>
                                    <Button variant={props.darkMode ? "dark" : "light"} size='sm' onClick={createRule} style={{margin: '0.1rem'}}>
                                        <AddOutlined/>
                                    </Button>
                                </OverlayTrigger>
                                <OverlayTrigger
                                    placement="right"
                                    delay={{ show: 400, hide: 400 }}
                                    overlay={
                                        <Tooltip id="button-tooltip" {...props}>
                                            Delete all rules
                                        </Tooltip>
                                    }>
                                    <Button variant={props.darkMode ? "dark" : "light"} size='sm' onClick={() => {setRuleList({action:'Empty'})}} style={{margin: '0.1rem'}}>
                                        <DeleteForeverOutlined/>
                                    </Button>
                                </OverlayTrigger>
                                <OverlayTrigger
                                    placement="right"
                                    delay={{ show: 400, hide: 400 }}
                                    overlay={
                                        <Tooltip id="button-tooltip" {...props}>
                                            Apply rules
                                        </Tooltip>
                                    }>
                                    <Button variant={props.darkMode ? "dark" : "light"} size='sm' onClick={commitChanges} style={{margin: '0.1rem'}}>
                                        <DoneOutlined/>
                                    </Button>
                                </OverlayTrigger>
                            </Stack>
                        </Stack>
                        </Stack>
                </Stack>
            </>
}
