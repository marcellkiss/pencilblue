/*

    Interface for managing users
    
    @author Blake Callens <blake.callens@gmail.com>
    @copyright PencilBlue 2013, All rights reserved

*/

this.init = function(request, output)
{
    var result = '';
    var instance = this;
    
    getSession(request, function(session)
    {
        if(!userIsAuthorized({logged_in: true, admin_level: ACCESS_EDITOR}))
        {
            output({content: ''});
            return;
        }
        
        getDBObjectsWithValues({object_type: 'user'}, function(data)
        {
            if(data.length == 0)
            {
                session.section = 'users';
                session.subsection = 'new_user';
                
                editSession(request, session, [], function(data)
                {
                    output({cookie: getSessionCookie(session), content: getJSTag('window.location = "' + SITE_ROOT + '/admin/users";')});
                });
                
                return;
            }
            
            var users = data;
            
            session.section = 'users';
            session.subsection = 'manage_users';
    
            initLocalization(request, session, function(data)
            {
                getHTMLTemplate('admin/users/manage_users', null, null, function(data)
                {
                    result = result.concat(data);
                    
                    displayErrorOrSuccess(session, result, function(newSession, newResult)
                    {
                        session = newSession;
                        result = newResult;
                        
                        instance.getUsersList(users, function(usersList)
                        {
                            result = result.split('^users^').join(usersList);
                            
                            editSession(request, session, [], function(data)
                            {
                                output({cookie: getSessionCookie(session), content: localize(['admin', 'users'], result)});
                            });
                        });
                    });
                });
            });
        });
    });
}

this.getUsersList = function(users, output)
{
    var usersList = '';
    var userTemplate = '';
    
    getHTMLTemplate('admin/users/manage_users/user', null, null, function(data)
    {
        userTemplate = data;
        
        for(var i = 0; i < users.length; i++)
        {
            var usersListElement = userTemplate.split('^user_id^').join(users[i]._id);
            usersListElement = usersListElement.split('^username^').join(users[i].username);
            usersListElement = usersListElement.split('^first_name^').join(users[i].first_name);
            usersListElement = usersListElement.split('^last_name^').join(users[i].last_name);
            
            usersList = usersList.concat(usersListElement);
        }
        
        output(usersList);
    });
}
