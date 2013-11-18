// Retrieve the header, body, and footer and return them to the router
this.init = function(request, output)
{
    var result = '';
    var instance = this;
    
    getSession(request, function(session)
    {
        if(!session['user'] || !session['user']['admin'])
        {
            output({content: ''});
            return;
        }
        
        session.section = 'article';
        session.subsection = 'new_article';
    
        initLocalization(request, session, function(data)
        {
            getHTMLTemplate('admin/content/articles/new_article', null, null, function(data)
            {
                result = result.concat(data);
                
                instance.getTemplateOptions(function(templatesList)
                {
                    result = result.split('^template_options^').join(templatesList);
                    
                    instance.getSectionOptions(function(sectionsList)
                    {
                        result = result.split('^section_options^').join(sectionsList);
                        
                        instance.getTopicOptions(function(topicsList)
                        {
                            result = result.split('^topic_options^').join(topicsList);
                        
                            displayErrorOrSuccess(session, result, function(newSession, newResult)
                            {
                                session = newSession;
                                result = newResult;
                        
                                editSession(request, session, [], function(data)
                                {
                                    output({content: localize(['admin', 'articles'], result)});
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

this.getTemplateOptions = function(output)
{
    availableTemplates = [];
    templatesList = '';
    
    getDBObjectsWithValues({object_type: 'setting', key: 'active_theme'}, function(data)
    {
        if(data.length > 0)
        {
            fs.readdir(DOCUMENT_ROOT + '/plugins/themes/' + data[0]['value'] + '/controllers', function(error, directory)
            {
                for(var file in directory)
                {
                    if(directory[file].indexOf('.js') > -1)
                    {
                        var templateFile = directory[file].substr(0, directory[file].indexOf('.js'));
                        availableTemplates.push(templateFile);
                    }
                }
                
                fs.readFile(DOCUMENT_ROOT + '/plugins/themes/' + data[0]['value'] + '/details.json', function(error, data)
                {
                    if(error)
                    {
                        output('');
                        return;
                    }
                    
                    var details = JSON.parse(data);
                    for(var i = 0; i < details.content_templates.length; i++)
                    {
                        for(var j = 0; j < availableTemplates.length; j++)
                        {
                            if(details.content_templates[i].file == availableTemplates[j])
                            {
                                templatesList = templatesList.concat('<option value="' + details.content_templates[i].file + '">' + details.content_templates[i].name + '</option>');
                            }
                        }
                    }
                    
                    output(templatesList);
                });
            });
        }
        else
        {
            output('');
        }
    });
}

this.getSectionOptions = function(output)
{
    var sections = [];
    var sectionTemplate = '';
    var subsectionTemplate = ''
    var sectionsList = '';
    
    getHTMLTemplate('admin/content/articles/new_article/section', null, null, function(data)
    {
        sectionTemplate = data;
        getHTMLTemplate('admin/content/articles/new_article/subsection', null, null, function(data)
        {
            subsectionTemplate = data;
            getDBObjectsWithValues({object_type: 'section', $orderby: {name: 1}}, function(data)
            {
                if(data.length > 0)
                {
                    for(var i = 0; i < data.length; i++)
                    {
                        if(!data[i].parent)
                        {
                            var sectionListElement = sectionTemplate.split('^section_id^').join(data[i]._id);
                            sectionListElement = sectionListElement.split('^section_name^').join(data[i].name);
                            sectionsList = sectionsList.concat(sectionListElement);
                        }
                        else
                        {
                            subsectionListElement = subsectionTemplate.split('^subsection_id^').join(data[i]._id);
                            subsectionListElement = subsectionListElement.split('^subsection_name^').join(data[i].name);
                            sectionsList = sectionsList.concat(subsectionListElement);
                        }
                    }
                }
                
                output(sectionsList);
            });
        });
    });
}

this.getTopicOptions = function(output)
{
    var topicsList = '';
    var topicTemplate = '';
    
    getDBObjectsWithValues({object_type: 'topic'}, function(data)
    {
        var topics = data;
        
        // Case insensitive sort
        topics.sort(function(a, b)
        {
            var x = a['name'].toLowerCase();
            var y = b['name'].toLowerCase();
        
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
        
        getHTMLTemplate('admin/content/articles/new_article/topic', null, null, function(data)
        {
            topicTemplate = data;

            for(var i = 0; i < topics.length; i++)
            {
                var topicsListElement = topicTemplate.split('^topic_id^').join(topics[i]._id.toString());
                topicsListElement = topicsListElement.split('^topic_name^').join(topics[i].name);
                topicsList = topicsList.concat(topicsListElement);
            }
            
            output(topicsList);
        });
    });
}