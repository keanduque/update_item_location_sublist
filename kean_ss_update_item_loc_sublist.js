/**
 *
 * Module Description
 * Populate Standard Cost from Item header to item location sublist
 * generate the csv file and import the csv file generated to update the item location sublist
 *
 * Version          Date                    Author              Remarks
 * 1.00             12 Nov 2020             kduque              Initial version
 * 1.01             25 Nov 2020             kduque              change the wfx Item standard cost to Purchase Price cost
 *
 * @NApiVersion 2.0
 * @NScriptType ScheduledScript
 */
define(['N/record',
        'N/runtime',
        'N/format',
        'N/search',
        'N/task',
        'N/file',
        './lib/NSUtilvSS2'],
    /**
     * @param {record} record
     * @param {runtime} runtime
     * @param {format} format
     * @param {search} search
     * @param {task} task
     * @param {file} task
     */
    function(record,
             runtime,
             format,
             search,
             task,
             file,
             NSUtil) {

        var objScript = runtime.getCurrentScript();

        var WFX_STANDARDCOST_SEARCH = objScript.getParameter({
            name: 'custscript_nscs_ss_stand_cost_search'
        });
        var CSV_FOLDER_ID = objScript.getParameter({
            name: 'custscript_nscs_ss_csv_folder_id'
        });
        var CSV_IMPORT_ID = objScript.getParameter({
            name: 'custscript_nscs_ss_csv_import_id'
        });

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {

            var csvLines = '';
            var importIds = [];
            //var csvHeader = 'Internal ID,Internal ID,Name,Inventory Location,WFX Item Standard Cost,Purchase Price,Current Standard Cost,Item Defined Cost\r\n';
            var csvHeader = 'Internal ID,Internal ID,Name,Inventory Location,Purchase Price,Location Standard Cost,Item Defined Cost\r\n';
            var updateCurrentStandardCost = "";
            var objFileCSV = {};
            //locationcost
            try{
                var wfxStandardCostSearch = search.load({
                    id: WFX_STANDARDCOST_SEARCH
                });

                var searchResult = wfxStandardCostSearch.run().getRange({
                    start   : 0,
                    end     : 1000
                });

                for(var i=0; i < searchResult.length; i++){

                    var internalId 	            = searchResult[i].getValue('internalid');
                    var itemId                  = searchResult[i].getValue('itemid');
                    var inventoryLocationName 	= searchResult[i].getText('inventorylocation');
                    var wfxItemStandardCost     = searchResult[i].getValue('custitem_item_standardcost');
                    var purchasePriceCost       = searchResult[i].getValue('cost');
                    var costEstimate 		    = searchResult[i].getValue('costestimate');
                    var inventoryLocation 	    = searchResult[i].getValue('inventorylocation');
                    var currentStandardCost     = searchResult[i].getValue('currentstandardcost');
                    var locationCost            = searchResult[i].getValue('locationcost');

                    log.debug('locationCost', locationCost);


                    // if (!NSUtil.isEmpty(purchasePriceCost) || purchasePriceCost != currentStandardCost) {
                    //     updateCurrentStandardCost = purchasePriceCost;
                    // } else {
                    //     updateCurrentStandardCost = 0;
                    // }

                    log.debug('purchasePriceCost', purchasePriceCost);


                    if(!NSUtil.isEmpty(purchasePriceCost) || purchasePriceCost != locationCost){
                        updateCurrentStandardCost = purchasePriceCost;
                    } else {
                        updateCurrentStandardCost = "";
                    }



                    log.debug('updateCurrentStandardCost', updateCurrentStandardCost);

                    //Add to CSV lines
                    csvLines+= internalId + ',';
                    csvLines+= internalId + ',';
                    csvLines+= itemId + ',';
                    csvLines+= inventoryLocationName + ',';
                    csvLines+= purchasePriceCost + ',';
                    csvLines+= updateCurrentStandardCost + ',';
                    csvLines+= costEstimate + '\r\n';

                    //Save custom record Id
                    importIds.push(internalId);
                }

                log.debug('csvLines', csvLines);

                if (!NSUtil.isEmpty(csvLines) && !NSUtil.isEmpty(importIds)) {
                    var csvContents = csvHeader + csvLines;

                    //Create CSV File
                    var stCsvFileName = new Date().getTime() + '' + '.csv';

                    log.debug('stCsvFileName', stCsvFileName);

                    var csvFile = file.create({
                        name: stCsvFileName,
                        fileType: file.Type.PLAINTEXT,
                        contents: csvContents,
                        encoding: file.Encoding.UTF_8,
                        folder: CSV_FOLDER_ID
                    });

                    var fileId = csvFile.save();
                    log.debug('fileId', 'fileId=' + fileId);

                    //log.debug('csvFile', csvFile);
                    log.debug('CSV_IMPORT_ID', CSV_IMPORT_ID);

                    var csvTask = task.create({
                        name: 'Inventory Item - ' + stCsvFileName,
                        taskType: task.TaskType.CSV_IMPORT,
                        importFile: csvFile,
                        mappingId: CSV_IMPORT_ID
                    });
                    log.debug('csvTask', 'csvTask=' + csvTask);

                    var csvImportTaskId = csvTask.submit();
                    log.debug('csvImportTaskId', 'csvImportTaskId=' + csvImportTaskId);
                }

                //Check CSV Import Status
                if (!NSUtil.isEmpty(csvImportTaskId)){

                    var status = '';
                    var csvStatus = task.checkStatus({
                        taskId: csvImportTaskId
                    });
                    if (!NSUtil.isEmpty(csvStatus)){
                        status = csvStatus.status;
                    }

                    log.debug('csvTaskStatus', 'csvTaskStatus=' + status);

                    if (status == task.TaskStatus.FAILED){

                        var runMsg = 'CSV Import Job was not successfully completed.';

                        log.debug('runMsg', runMsg);

                    }else{
                        //Update CSV Import
                        log.debug('updateImportRec', 'Import Records: ' + importIds.length + '; Remaining Units: ' + objScript.getRemainingUsage());
                    }
                }

            }catch(ex){
                var errorStr = (ex.id != null) ? ex.name + '\n' + ex.message + '\n' : ex.toString();
                log.error('execute', 'Error encountered while composing CSV lines. Error: ' + errorStr);
            }
        }

        return {
            execute: execute
        };

    });
